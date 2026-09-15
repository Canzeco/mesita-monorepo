// Supabase Edge Function — business-web-start-membership (product caller)
//
// The paid door into Mesita Partner (MESITA-1877). An OWNER buys the yearly
// **Mesita Membership** for an organization; every place it holds is in.
//
// This is now the ONLY paid door into the partnership: MESITA-1889 retired
// the per-PLACE Verified checkout (`business-web-change-subscription`) and
// the operator switch (`business-web-set-org-partnership`), so
// `organizations.partnered` has exactly one writer — this EF under
// MOCK_SUBSCRIPTION, and the Stripe webhook for real money.
//
// Body: { orgId: string, successUrl?: string, cancelUrl?: string }
// Response: { ok: true, checkout_url: string, mock?: true }
//           { ok: true, already_member: true, current_period_end }
//
// Auth: owner of the organization. Same rung as Connect Stripe — the person
// who signs a yearly commitment is the person who owns the account, and
// `requireOrgRole` does NOT auto-allow super-admins, so an operator buying on
// someone's behalf has to join the organization first.
//
// NOT STRIPE-LOCKED. The old Partner switch refused without a Ready Connect
// account; Pato struck that on 2026-09-15 because onboarding friction shrinks
// the market. An organization can buy a Membership having never met Stripe
// Connect — Connect is what Mesita Pay needs, and Mesita Pay is the add-on.
//
// TWO MODES, the same MOCK_SUBSCRIPTION toggle the other two checkout EFs use:
//
//   • MOCK — writes an active mock membership row and entitles the
//     organization immediately. No money moves. Also the mode whenever no
//     Stripe key is configured, so a fresh environment works out of the box.
//   • REAL — creates a Stripe Checkout Session and entitles NOTHING. The
//     webhook flips `organizations.partnered` once Stripe confirms, which is
//     the only order that cannot hand out a partnership for an abandoned
//     checkout.
//
// Local:  supabase functions serve business-web-start-membership
// Deploy: supabase functions deploy business-web-start-membership

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import {
  corsPreflight,
  json,
  readJson,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { requireOrgRole } from "../_shared/org-membership.ts";
import {
  applyMembershipEntitlement,
  isMockSubscriptionId,
  MEMBERSHIP_CATALOG_ID,
  MEMBERSHIP_PLAN_KEY,
  readLiveMembership,
} from "../_shared/partner-membership.ts";
import {
  ensureOrgBillingCustomer,
  ensureWholeCatalog,
  liveChargesBlocked,
  resolvePlanPrice,
  STRIPE_API_VERSION,
} from "../_shared/stripe-billing.ts";
import { stripeSecretKey } from "../_shared/stripe-env.ts";

type Body = { orgId?: unknown; successUrl?: unknown; cancelUrl?: unknown };

const MOCK_PERIOD_DAYS = 365;

// ⚠️ DEMO MOCK — the one on/off switch shared with the other checkout EFs.
// Set MOCK_SUBSCRIPTION=false and redeploy to require a real Stripe payment.
// Agents must never flip this (MESITA-37); it is an operator's call.
const MOCK_SUBSCRIPTION =
  (Deno.env.get("MOCK_SUBSCRIPTION") ?? "true").toLowerCase() !== "false";

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

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
  const orgId = str(bodyRes.body.orgId);
  if (!orgId) return json({ ok: false, error: "orgId is required" }, 400);

  const admin = adminClient(envRes.env);
  const roleRes = await requireOrgRole(admin, authRes.user, orgId, ["owner"]);
  if (!roleRes.ok) return roleRes.response;

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("id, name")
    .eq("id", orgId)
    .maybeSingle();
  if (orgErr) return json({ ok: false, error: orgErr.message }, 500);
  if (!org) return json({ ok: false, error: "Organization not found" }, 404);

  const stripeKey = stripeSecretKey();
  const mockMode = MOCK_SUBSCRIPTION || !stripeKey;

  // Already a member? Say so rather than selling a second subscription —
  // `partner_memberships_one_live` would reject the row anyway, but only after
  // the owner had already been charged.
  //
  // A LEFTOVER MOCK GRANT IS NOT A MEMBERSHIP ON THE REAL PATH. MOCK_SUBSCRIPTION
  // writes `mock_<orgId>` rows with state active; once an operator turns the
  // flag off, every organization that took a mock grant would be a permanent
  // partner with nothing billable behind it and no way to buy — this gate
  // would refuse the only door out. So in real mode we fall through and sell,
  // and the webhook retires the mock row when the real subscription lands.
  // (Same rule `business-web-change-subscription` applies to place rows.)
  const live = await readLiveMembership(admin, orgId);
  if (!live.ok) {
    return json({ ok: false, error: `membership_read: ${live.error}` }, 500);
  }
  const liveIsMock = isMockSubscriptionId(live.row?.stripe_subscription_id);
  if (live.row && (mockMode || !liveIsMock)) {
    return json({
      ok: true,
      already_member: true,
      state: live.row.state,
      current_period_end: live.row.current_period_end,
    });
  }

  const origin = req.headers.get("origin") ?? "";
  const successUrl = str(bodyRes.body.successUrl) ||
    `${origin}/orgs/${orgId}/products?membership=return`;
  const cancelUrl = str(bodyRes.body.cancelUrl) ||
    `${origin}/orgs/${orgId}/products?membership=cancelled`;

  const { data: planRow } = await admin
    .from("org_plans")
    .select("key, label, price_cents, currency")
    .eq("key", MEMBERSHIP_PLAN_KEY)
    .maybeSingle();
  if (!planRow) {
    return json(
      { ok: false, error: `Plan '${MEMBERSHIP_PLAN_KEY}' is not configured` },
      500,
    );
  }
  const plan = planRow as {
    price_cents: number;
    currency: string | null;
  };

  // ── MOCK mode ─────────────────────────────────────────────────────────────
  if (mockMode) {
    const periodEnd = new Date(
      Date.now() + MOCK_PERIOD_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    // Stable per-org id so re-subscribing updates the same row instead of
    // tripping partner_memberships_one_live.
    const mockSubId = `mock_${orgId}`;

    const mirror = await admin.from("partner_memberships").upsert(
      {
        organization_id: orgId,
        plan_key: MEMBERSHIP_PLAN_KEY,
        stripe_subscription_id: mockSubId,
        stripe_customer_id: `mock_cus_${orgId}`,
        state: "active",
        price_cents: plan.price_cents,
        currency: plan.currency ?? "MXN",
        current_period_end: periodEnd,
        cancel_at_period_end: false,
      },
      { onConflict: "stripe_subscription_id" },
    );
    if (mirror.error) {
      return json(
        { ok: false, error: `mock_membership: ${mirror.error.message}` },
        500,
      );
    }

    const entitled = await applyMembershipEntitlement(admin, orgId, "entitle");
    if (!entitled.ok) {
      return json({ ok: false, error: `mock_grant: ${entitled.error}` }, 500);
    }

    return json({
      ok: true,
      checkout_url: successUrl,
      mock: true,
      partnered: entitled.partnered,
      placesJoined: entitled.placesJoined,
      current_period_end: periodEnd,
    });
  }

  // ── REAL Stripe mode ──────────────────────────────────────────────────────
  const liveBlock = liveChargesBlocked(stripeKey!);
  if (liveBlock) {
    return json(
      { ok: false, error: liveBlock, code: "stripe_live_blocked" },
      409,
    );
  }
  const stripe = new Stripe(stripeKey!, { apiVersion: STRIPE_API_VERSION });

  // Self-provisioning: materializes the product + price from org_plans on the
  // first real checkout after a deploy, and re-provisions when the row's
  // price changes. No dashboard step.
  const resolved = await resolvePlanPrice(admin, stripe, MEMBERSHIP_CATALOG_ID);
  if (!resolved) {
    return json({ ok: false, error: "Membership price not configured" }, 500);
  }
  void ensureWholeCatalog(admin, stripe);

  const customerId = await ensureOrgBillingCustomer(
    admin,
    stripe,
    orgId,
    (org as { name?: string | null }).name ?? null,
  );

  // `organization_id` on BOTH the session and the subscription: the session
  // carries checkout.session.completed, the subscription carries every
  // customer.subscription.* that follows for the rest of the membership's
  // life. Metadata on one only would leave the webhook unable to route the
  // renewal a year later.
  const metadata = {
    organization_id: orgId,
    plan_key: MEMBERSHIP_PLAN_KEY,
    mesita_kind: "business_membership",
  };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: orgId,
    line_items: [{ price: resolved.priceId, quantity: 1 }],
    metadata,
    subscription_data: { metadata },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  // The incomplete row is a record that a checkout was opened, nothing more:
  // `state: "incomplete"` is outside the one-live index and
  // membershipOutcome() maps it to "mirror", so an abandoned checkout can
  // neither entitle nor revoke anything.
  await admin.from("partner_memberships").upsert(
    {
      organization_id: orgId,
      plan_key: MEMBERSHIP_PLAN_KEY,
      stripe_customer_id: customerId,
      state: "incomplete",
      price_cents: resolved.priceCents,
      currency: resolved.currency,
    },
    { onConflict: "stripe_subscription_id", ignoreDuplicates: true },
  );

  return json({ ok: true, checkout_url: session.url });
});
