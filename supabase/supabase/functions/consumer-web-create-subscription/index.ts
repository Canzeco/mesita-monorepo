// Supabase Edge Function — consumer-web-create-subscription (product caller)
//
// Authenticated. The paid "door" into Mesita Premium.
//
// Two modes, chosen by the MOCK_SUBSCRIPTION toggle below:
//
//   • MOCK — grants Premium immediately (origin 'subscription'), records a
//     mock active subscription, and returns the success URL so the client's
//     redirect lands on the post-checkout page. No money moves.
//
//   • REAL — creates a Stripe Checkout Session and returns its hosted URL.
//     Tier is NOT granted here; the Stripe webhook (stripe-webhook-handle-event)
//     flips it once payment clears.
//
// Body: { successUrl?: string, cancelUrl?: string }
// Response: { ok: true, checkout_url: string, mock?: true }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import {
  corsPreflight,
  json,
  readJsonOr,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { recomputeConsumerClass } from "../_shared/class-doors.ts";
import {
  ensureConsumerCustomer,
  ensureWholeCatalog,
  liveChargesBlocked,
  resolvePlanPrice,
  STRIPE_API_VERSION,
} from "../_shared/stripe-billing.ts";

type Body = { successUrl?: string; cancelUrl?: string };

const MOCK_PERIOD_DAYS = 30;

// ⚠️ DEMO MOCK — the single on/off switch for instant Premium.
//
// When true, "Subscribe" grants Premium right away with no payment and no
// Stripe call. This is the easy change: set the MOCK_SUBSCRIPTION env to
// "false" (or flip this default to false) and redeploy to require a real
// Stripe Checkout payment again. Mock also runs whenever STRIPE_SECRET_KEY
// is absent, so a project with no Stripe secret still works out of the box.
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
  const consumerId = authRes.user.id;

  const body = await readJsonOr<Body>(req, {});

  const admin = adminClient(envRes.env);
  // Price is the PLAN, not the class: it lives on consumer_plans.
  const { data: premium } = await admin
    .from("consumer_plans")
    .select("price_cents, currency")
    .eq("key", "premium")
    .maybeSingle();

  const origin = req.headers.get("origin") ?? "";
  const successUrl = body.successUrl ??
    `${origin}/profile?subscription=success`;
  const cancelUrl = body.cancelUrl ??
    `${origin}/profile?subscription=cancelled`;

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

  // ── MOCK mode ───────────────────────────────────────────────────────────
  // Fires when the demo toggle is on, or when there's no Stripe secret to
  // run real billing with.
  if (MOCK_SUBSCRIPTION || !stripeKey) {
    const periodEnd = new Date(
      Date.now() + MOCK_PERIOD_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    // Stable per-consumer id so re-subscribing updates the same row instead
    // of tripping the one-live-subscription-per-consumer unique index.
    const mockSubId = `mock_${consumerId}`;

    const sub = await admin
      .from("consumer_subscriptions")
      .upsert(
        {
          consumer_id: consumerId,
          stripe_subscription_id: mockSubId,
          stripe_customer_id: `mock_cus_${consumerId}`,
          status: "active",
          price_cents: premium?.price_cents ?? 5000,
          currency: premium?.currency ?? "MXN",
          current_period_end: periodEnd,
          cancel_at_period_end: false,
        },
        { onConflict: "stripe_subscription_id" },
      );
    if (sub.error) {
      return json({
        ok: false,
        error: `mock_subscription: ${sub.error.message}`,
      }, 500);
    }

    // The paid-door fact is the mock subscription row above; the slot is
    // derived. The shared recompute lands the highest-ranked open door
    // (MESITA-972) — an Aura member who subscribes stays Aura while the
    // subscription keeps running as an open door.
    try {
      await recomputeConsumerClass(admin, consumerId);
    } catch (err) {
      return json({ ok: false, error: `mock_grant: ${String(err)}` }, 500);
    }

    return json({ ok: true, checkout_url: successUrl, mock: true });
  }

  // ── REAL Stripe mode ──────────────────────────────────────────────────────
  const liveBlock = liveChargesBlocked(stripeKey);
  if (liveBlock) {
    return json(
      { ok: false, error: liveBlock, code: "stripe_live_blocked" },
      409,
    );
  }
  const stripe = new Stripe(stripeKey, { apiVersion: STRIPE_API_VERSION });

  // Self-provisioning: resolves (and if needed creates) the $-current monthly
  // Premium price in the connected Stripe account, so a fresh account or a
  // price change never needs a dashboard step.
  const resolved = await resolvePlanPrice(admin, stripe, "consumer_premium");
  if (!resolved) {
    return json({ ok: false, error: "Premium price not configured" }, 500);
  }
  // Materialize the rest of the catalog in the background (best effort).
  void ensureWholeCatalog(admin, stripe);

  // ONE customer per consumer, resolved through the shared anchor
  // (consumers.stripe_customer_id) that the Cards wallet also uses. This EF
  // used to look the id up on consumer_subscriptions inline; that only ever
  // existed for subscribers, so a guest who saved a card first would have
  // been given a second customer here. ensureConsumerCustomer backfills from
  // the subscription row, so nothing regresses for existing subscribers.
  const customerId = await ensureConsumerCustomer(admin, stripe, consumerId);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: consumerId,
    line_items: [{ price: resolved.priceId, quantity: 1 }],
    metadata: { consumer_id: consumerId, mesita_kind: "consumer" },
    subscription_data: {
      metadata: { consumer_id: consumerId, mesita_kind: "consumer" },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  await admin.from("consumer_subscriptions").upsert(
    {
      consumer_id: consumerId,
      stripe_customer_id: customerId,
      status: "incomplete",
      price_cents: resolved.priceCents,
      currency: resolved.currency,
    },
    { onConflict: "stripe_subscription_id", ignoreDuplicates: true },
  );

  return json({ ok: true, checkout_url: session.url });
});
