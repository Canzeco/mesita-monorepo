// Supabase Edge Function — business-web-change-subscription (product caller)
//
// Authenticated, owner-only. The paid door into a place's plan:
//   Free  — no membership
//   Pro   — Promos v4 Verified membership (MX$1,000/year) — the only sold SKU
//
// Legacy `ultra` is still accepted for already-subscribed places (no-op /
// switch-to-Verified) but is no longer a purchasable product (MESITA-541).
//
// A Stripe subscription is billing, not entitlement: projects.plan is the
// single source of truth and can be granted through other doors (admin,
// partnership). This EF and the Stripe webhook only ever couple the two for
// plans that came through the paid door.
//
// Modes, chosen by the same MOCK_SUBSCRIPTION toggle consumer billing uses:
//
//   • MOCK — grants the plan immediately, records a mock active subscription
//     row, and returns the success URL. No money moves. Also runs whenever
//     STRIPE_SECRET_KEY is absent so a project with no Stripe secret still
//     works out of the box.
//
//   • REAL — creates a Stripe Checkout Session (or cancels the live
//     subscription in place) and lets stripe-webhook-handle-event flip
//     projects.plan once Stripe confirms.
//
// Body: { projectId: string, plan: "free" | "pro" | "ultra",
//         successUrl?: string, cancelUrl?: string }
// Response (one of):
//   { ok: true, checkout_url: string, mock?: true }   — go pay (or mock-paid)
//   { ok: true, plan, already_subscribed: true }      — no-op
//   { ok: true, plan, plan_switched: true }           — legacy ultra → pro
//   { ok: true, plan: "free", scheduled_downgrade: true, current_period_end }
//   { ok: true, plan: "free" }                        — downgraded now

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { corsPreflight, json, readJson, readPlaceIdAlias, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv, requireOwner } from "../_shared/auth.ts";
import {
  ensureWholeCatalog,
  liveChargesBlocked,
  resolvePlanPrice,
  STRIPE_API_VERSION,
} from "../_shared/stripe-billing.ts";
import {
  applyListingTypeToPatch,
} from "../_shared/partner-derivation.ts";
import { type ProjectPatch, writePlace } from "../_shared/place-doc.ts";
import { ratesFromPlace } from "../_shared/promo-strategy.ts";

type Body = {
  /** Canonical place-row id key (MESITA-26); `projectId` kept as legacy alias. */
  placeId?: string;
  projectId?: string;
  plan?: string;
  successUrl?: string;
  cancelUrl?: string;
};

// New purchases only sell Verified (`pro`). `ultra` stays for legacy no-ops /
// switches onto Verified.
const PAID_PLANS = new Set(["pro", "ultra"]);
const VERIFIED_PLAN = "pro";
const MOCK_PERIOD_DAYS = 365; // annual membership

function loadProjectRow(
  admin: ReturnType<typeof adminClient>,
  projectId: string,
) {
  return admin
    .from("projects")
    .select(
      "plan, listing_type, welcome_free_rate, welcome_premium_rate, free_rate, premium_rate",
    )
    .eq("id", projectId)
    .maybeSingle();
}

function planPatchForRow(
  row: Record<string, unknown>,
  plan: string,
): Record<string, unknown> {
  const patch: Record<string, unknown> = { plan };
  applyListingTypeToPatch(patch, {
    plan,
    rates: ratesFromPlace(row),
    currentListingType: row.listing_type as string,
  });
  if (plan === "free") {
    patch.plan_live_at = null;
    patch.first_ticket_honored_at = null;
  }
  return patch;
}

// ⚠️ DEMO MOCK — same single on/off switch as consumer-web-create-subscription.
// Set the MOCK_SUBSCRIPTION env to "false" and redeploy to require real
// Stripe Checkout payments. Agents must never flip this (MESITA-37).
const MOCK_SUBSCRIPTION =
  (Deno.env.get("MOCK_SUBSCRIPTION") ?? "true").toLowerCase() !== "false";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const projectId = readPlaceIdAlias(bodyRes.body);
  const requestedPlan = (bodyRes.body.plan ?? "").toString().trim();
  if (!projectId) return json({ ok: false, error: "projectId is required" }, 400);
  if (requestedPlan !== "free" && !PAID_PLANS.has(requestedPlan)) {
    return json({ ok: false, error: "plan must be one of free | pro | ultra" }, 400);
  }

  // New paid purchases always land on Verified (`pro`). Requesting `ultra`
  // is treated as Verified so legacy callers don't 400.
  const plan = requestedPlan === "ultra" ? VERIFIED_PLAN : requestedPlan;

  const admin = adminClient(envRes.env);

  // Billing is owner-level (super-admins bypass inside requireOwner).
  const ownerRes = await requireOwner(
    admin,
    authRes.user,
    projectId,
    "Only owners can change the subscription.",
  );
  if (!ownerRes.ok) return ownerRes.response;

  const origin = req.headers.get("origin") ?? "";
  const successUrl =
    bodyRes.body.successUrl ??
    `${origin}/place/${projectId}/promos?subscription=success`;
  const cancelUrl =
    bodyRes.body.cancelUrl ??
    `${origin}/place/${projectId}/promos?subscription=cancelled`;

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const mockMode = MOCK_SUBSCRIPTION || !stripeKey;

  // The one live billing row for this project, if any. Mock rows are
  // recognisable by their id prefix regardless of the current toggle.
  const { data: liveSub } = await admin
    .from("project_subscriptions")
    .select("stripe_subscription_id, stripe_customer_id, plan_key, current_period_end")
    .eq("place_id", projectId)
    .in("status", ["active", "past_due"])
    .maybeSingle();
  const liveSubId = (liveSub?.stripe_subscription_id ?? "") as string;
  const liveIsMock = liveSubId.startsWith("mock_");

  // ── Downgrade to free ─────────────────────────────────────────────────────
  if (plan === "free") {
    if (liveSub && !liveIsMock && stripeKey) {
      // Real live subscription: cancel at period end; the plan stays paid
      // until then and the webhook flips it on customer.subscription.deleted.
      const stripe = new Stripe(stripeKey, { apiVersion: STRIPE_API_VERSION });
      await stripe.subscriptions.update(liveSubId, {
        cancel_at_period_end: true,
      });
      await admin
        .from("project_subscriptions")
        .update({ cancel_at_period_end: true })
        .eq("stripe_subscription_id", liveSubId);
      return json({
        ok: true,
        plan: "free",
        scheduled_downgrade: true,
        current_period_end: liveSub.current_period_end ?? null,
      });
    }

    // Mock subscription (or nothing billable on file): downgrade now.
    if (liveSub && liveIsMock) {
      await admin
        .from("project_subscriptions")
        .update({ status: "canceled", cancel_at_period_end: true })
        .eq("stripe_subscription_id", liveSubId);
    }
    const projectRow = await loadProjectRow(admin, projectId);
    if (projectRow.error) {
      return json({ ok: false, error: `project_read: ${projectRow.error.message}` }, 500);
    }
    if (!projectRow.data) {
      return json({ ok: false, error: "Place not found" }, 404);
    }
    const down = await writePlace(admin, {
      table: "projects",
      mode: "update",
      id: projectId,
      patch: planPatchForRow(projectRow.data as Record<string, unknown>, "free") as ProjectPatch,
    });
    if (!down.ok) {
      return json({ ok: false, error: `downgrade: ${down.error}` }, 500);
    }
    return json({ ok: true, plan: "free" });
  }

  // ── Paid Verified membership ──────────────────────────────────────────────
  const { data: planRow } = await admin
    .from("project_plans")
    .select("key, label, price_cents, currency")
    .eq("key", VERIFIED_PLAN)
    .maybeSingle();
  if (!planRow) {
    return json({ ok: false, error: `Plan '${VERIFIED_PLAN}' is not configured` }, 500);
  }

  // Already on Verified (or legacy ultra)? No-op — UNLESS we're in real mode
  // and the live row is only a leftover mock grant. In that case fall through
  // so the owner gets real Stripe billing; the webhook retires the mock row
  // when the real subscription lands.
  const livePlan = (liveSub?.plan_key ?? "") as string;
  const alreadyVerified =
    livePlan === VERIFIED_PLAN || livePlan === "ultra";
  if (alreadyVerified && (mockMode || !liveIsMock)) {
    return json({ ok: true, plan: VERIFIED_PLAN, already_subscribed: true });
  }

  // ── MOCK mode ─────────────────────────────────────────────────────────────
  if (mockMode) {
    const periodEnd = new Date(
      Date.now() + MOCK_PERIOD_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    // Stable per-project id so re-subscribing updates the same row instead of
    // tripping the one-live-subscription-per-project unique index.
    const mockSubId = `mock_${projectId}`;

    const sub = await admin
      .from("project_subscriptions")
      .upsert(
        {
          place_id: projectId,
          plan_key: VERIFIED_PLAN,
          stripe_subscription_id: mockSubId,
          stripe_customer_id: `mock_cus_${projectId}`,
          status: "active",
          price_cents: planRow.price_cents,
          currency: planRow.currency ?? "MXN",
          current_period_end: periodEnd,
          cancel_at_period_end: false,
        },
        { onConflict: "stripe_subscription_id" },
      );
    if (sub.error) {
      return json({ ok: false, error: `mock_subscription: ${sub.error.message}` }, 500);
    }

    const projectRow = await loadProjectRow(admin, projectId);
    if (projectRow.error) {
      return json({ ok: false, error: `project_read: ${projectRow.error.message}` }, 500);
    }
    if (!projectRow.data) {
      return json({ ok: false, error: "Place not found" }, 404);
    }
    const grant = await writePlace(admin, {
      table: "projects",
      mode: "update",
      id: projectId,
      patch: planPatchForRow(projectRow.data as Record<string, unknown>, VERIFIED_PLAN) as ProjectPatch,
    });
    if (!grant.ok) {
      return json({ ok: false, error: `mock_grant: ${grant.error}` }, 500);
    }

    return json({ ok: true, plan: VERIFIED_PLAN, checkout_url: successUrl, mock: true });
  }

  // ── REAL Stripe mode ──────────────────────────────────────────────────────
  const liveBlock = liveChargesBlocked(stripeKey!);
  if (liveBlock) return json({ ok: false, error: liveBlock, code: "stripe_live_blocked" }, 409);
  const stripe = new Stripe(stripeKey!, { apiVersion: STRIPE_API_VERSION });

  const resolved = await resolvePlanPrice(admin, stripe, "business_verified");
  if (!resolved) {
    return json({ ok: false, error: `Plan '${VERIFIED_PLAN}' price not configured` }, 500);
  }
  // Materialize the rest of the catalog in the background (best effort).
  void ensureWholeCatalog(admin, stripe);

  // Live real subscription on a legacy ultra price → switch onto Verified
  // (prorated); the webhook reconciles the mirror + projects.plan.
  if (liveSub && !liveIsMock) {
    const current = await stripe.subscriptions.retrieve(liveSubId);
    const itemId = current.items.data[0]?.id;
    if (!itemId) {
      return json({ ok: false, error: "Live subscription has no item to switch" }, 500);
    }
    await stripe.subscriptions.update(liveSubId, {
      items: [{ id: itemId, price: resolved.priceId }],
      proration_behavior: "create_prorations",
      cancel_at_period_end: false,
      metadata: {
        project_id: projectId,
        plan_key: VERIFIED_PLAN,
        mesita_kind: "business",
      },
    });
    // Optimistic flip — the subsequent customer.subscription.updated webhook
    // writes the same values idempotently.
    await admin
      .from("project_subscriptions")
      .update({
        plan_key: VERIFIED_PLAN,
        price_cents: resolved.priceCents,
        currency: resolved.currency,
        cancel_at_period_end: false,
      })
      .eq("stripe_subscription_id", liveSubId);
    const projectRow = await loadProjectRow(admin, projectId);
    if (projectRow.error) {
      return json({ ok: false, error: `project_read: ${projectRow.error.message}` }, 500);
    }
    if (!projectRow.data) {
      return json({ ok: false, error: "Place not found" }, 404);
    }
    await writePlace(admin, {
      table: "projects",
      mode: "update",
      id: projectId,
      patch: planPatchForRow(projectRow.data as Record<string, unknown>, VERIFIED_PLAN) as ProjectPatch,
    });
    return json({ ok: true, plan: VERIFIED_PLAN, plan_switched: true });
  }

  // Fresh checkout. Reuse an existing real Stripe customer if this project
  // has been through billing before.
  const { data: existing } = await admin
    .from("project_subscriptions")
    .select("stripe_customer_id")
    .eq("place_id", projectId)
    .not("stripe_customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let customerId = (existing?.stripe_customer_id as string | null) ?? null;
  if (!customerId || customerId.startsWith("mock_")) {
    const customer = await stripe.customers.create({
      metadata: { project_id: projectId },
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: projectId,
    line_items: [{ price: resolved.priceId, quantity: 1 }],
    metadata: {
      project_id: projectId,
      plan_key: VERIFIED_PLAN,
      mesita_kind: "business",
    },
    subscription_data: {
      metadata: {
        project_id: projectId,
        plan_key: VERIFIED_PLAN,
        mesita_kind: "business",
      },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  await admin.from("project_subscriptions").upsert(
    {
      place_id: projectId,
      plan_key: VERIFIED_PLAN,
      stripe_customer_id: customerId,
      status: "incomplete",
      price_cents: resolved.priceCents,
      currency: resolved.currency,
    },
    { onConflict: "stripe_subscription_id", ignoreDuplicates: true },
  );

  return json({ ok: true, plan: VERIFIED_PLAN, checkout_url: session.url });
});
