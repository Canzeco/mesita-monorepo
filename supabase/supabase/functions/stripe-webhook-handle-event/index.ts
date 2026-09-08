// Supabase Edge Function — stripe-webhook-handle-event (external caller)
//
// Public endpoint (verify_jwt disabled at the gateway). Security rests
// entirely on Stripe signature verification — an unsigned or mis-signed
// request is rejected. SEVERAL signing secrets serve the one URL: the
// platform endpoint's, and the Connect endpoint's once the operator creates
// it (same URL — needs-human dashboard step: enabled_events must name
// account.updated, payment_intent.succeeded and payment_intent.payment_
// failed, not just the first) — in both universes, since STRIPE_MODE keeps
// test and live credentials side by side (stripe-env.ts). Every configured
// secret is tried (webhook-verify.ts), so a correctly-signed event from the
// universe STRIPE_MODE is NOT on still verifies — and is then acked WITHOUT
// being processed, which is what keeps a mode flip from costing a
// multi-day Stripe retry storm.
//
// One endpoint, four surfaces:
//   • consumer_id  → consumer Premium ($50 MXN/mo). The ONLY writer that
//     flips a consumer to/from Premium on the back of the paid door.
//   • place_id     → place plans (Verified / plan=pro; ultra legacy). The ONLY writer that flips
//     places.plan on the back of the paid door.
//   • Connect account.updated → organization_payment_accounts mirror (PLATFORM
//     account layer, connect-account.ts).
//   • Connect payment_intent.{succeeded,payment_failed} → Mesita Pay's
//     reliability backstop (MESITA-1414, ticket-payment-intent.ts) — the
//     synchronous charge in consumer-web-select-ticket-payment closes the
//     ticket itself in the common case; this only matters if that request
//     crashed between Stripe confirming and the close running. THE SAME TWO
//     event types also back a Credits purchase (MESITA-1676,
//     credit-payment-intent.ts) — routed by intent.metadata.mesita_kind ===
//     "credit_purchase", since both callers share one Connect endpoint and
//     Stripe delivers the same event type for either.
//   Connect-DELIVERED events (top-level event.account set) are guarded to
//   exactly these three types: a restaurant's own Stripe subscriptions or
//   other account activity must never reach the platform reconcilers below.
//
// Idempotency: Stripe retries deliveries. We record every processed event id
// in public.stripe_events and no-op on replays.
//
// Tier/plan precedence rule: a subscription lapse only downgrades an
// entitlement that came through the paid door. A consumer's Premium earned
// via Instagram or invitation is never stripped because a card failed — and
// a place plan granted outside billing is only lowered when it matches the
// plan the lapsed subscription was paying for.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { jsonError, rejectUnlessMethods } from "../_shared/http.ts";
import { STRIPE_API_VERSION } from "../_shared/stripe-billing.ts";
import {
  eventMatchesMode,
  stripeMode,
  stripeSecretKey,
  stripeWebhookSecrets,
} from "../_shared/stripe-env.ts";
import {
  resolveConsumerId,
  resolvePlaceId,
  resolvePlanKey,
} from "./subscription-resolve.ts";
import {
  applyListingTypeToPatch,
} from "../_shared/partner-derivation.ts";
import { recomputeConsumerClass } from "../_shared/class-doors.ts";
import { type PlacePatch, writePlace } from "../_shared/place-doc.ts";
import { ratesFromPlace } from "../_shared/promo-strategy.ts";
import { subscriptionSnapshot } from "./subscription-snapshot.ts";
import { verifyStripeEvent } from "./webhook-verify.ts";
import { handleConnectAccountUpdated } from "./connect-account.ts";
import {
  handleTicketPaymentIntentFailed,
  handleTicketPaymentIntentSucceeded,
} from "./ticket-payment-intent.ts";
import {
  handleCreditPurchaseIntentFailed,
  handleCreditPurchaseIntentSucceeded,
  isCreditPurchaseIntentEvent,
} from "./credit-payment-intent.ts";

Deno.serve(async (req) => {
  // Vendor webhook — no CORS preflight; POST-only.
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;

  const mode = stripeMode();
  const stripeKey = stripeSecretKey();
  const webhookSecrets = stripeWebhookSecrets();
  if (!stripeKey || webhookSecrets.length === 0) {
    return jsonError("Stripe not configured", 500);
  }
  const stripe = new Stripe(stripeKey, { apiVersion: STRIPE_API_VERSION });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return jsonError("Missing signature", 400);

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await verifyStripeEvent(stripe, raw, sig, webhookSecrets);
  } catch (err) {
    console.error("[stripe-webhook-handle-event] signature verification failed:", err);
    return jsonError("Invalid signature", 400);
  }

  // A correctly-signed delivery from the OTHER universe: the endpoint we are
  // no longer listening to still has our URL, or both endpoints do. It is not
  // ours to act on — a live subscription must never move a row while
  // STRIPE_MODE=test, and vice versa. Ack so Stripe stops retrying, record
  // nothing, so that flipping the mode later replays these events cleanly.
  if (!eventMatchesMode(event, mode)) {
    console.log(
      `[stripe-webhook-handle-event] ignored ${event.type} (${event.id}): livemode=${event.livemode} under STRIPE_MODE=${mode}`,
    );
    return new Response(
      JSON.stringify({ received: true, ignored: "livemode_mismatch" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const admin = adminClient(envRes.env);

  // Idempotency guard. If the event id is already recorded, this is a replay.
  const dedupe = await admin
    .from("stripe_events")
    .insert({ event_id: event.id });
  if (dedupe.error) {
    // 23505 = unique violation = already processed. Anything else is a real
    // error, but we still 200 so Stripe doesn't hammer retries on a transient.
    if (dedupe.error.code === "23505") {
      return new Response(JSON.stringify({ received: true, replay: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.error("[stripe-webhook-handle-event] dedupe insert error:", dedupe.error);
  }

  try {
    await handleStripeEvent(admin, stripe, event);
  } catch (err) {
    console.error(`[stripe-webhook-handle-event] handler error (${event.type}):`, err);
    // Roll back the dedupe marker so Stripe's retry re-processes this event
    // instead of hitting the replay short-circuit and dropping it forever.
    await admin.from("stripe_events").delete().eq("event_id", event.id);
    return jsonError("Handler error", 500);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function handleStripeEvent(
  admin: ReturnType<typeof adminClient>,
  stripe: Stripe,
  event: Stripe.Event,
): Promise<void> {
  // Connect-DELIVERED events (top-level event.account) are guarded to the
  // types the Connect endpoint exists for. Anything else a mis-configured
  // endpoint subscribes (e.g. a restaurant's own customer.subscription.*)
  // is acknowledged and ignored — it must never reach the platform
  // subscription reconcilers below.
  if (typeof event.account === "string" && event.account.length > 0) {
    switch (event.type) {
      case "account.updated":
        await handleConnectAccountUpdated(admin, event);
        break;
      case "payment_intent.succeeded": {
        // Two different callers share this event type on the SAME Connect
        // endpoint, and mesita_kind is the only thing that tells them apart
        // — a restaurant's own Stripe traffic carries neither and falls
        // through to whichever handler's own metadata check no-ops it.
        if (isCreditPurchaseIntentEvent(event)) {
          // Credits purchase backstop (MESITA-1676) — see
          // credit-payment-intent.ts. consumer-web-buy-credits already
          // writes the lot in the common case; this only does anything if
          // that request crashed, or the guest finished a 3DS challenge
          // after it already returned.
          await handleCreditPurchaseIntentSucceeded(admin, event);
        } else {
          // Mesita Pay's reliability backstop (MESITA-1414) — see
          // ticket-payment-intent.ts. The synchronous charge path in
          // consumer-web-select-ticket-payment already closes the ticket in
          // the common case; this only does anything if that request crashed
          // between Stripe confirming and the close running.
          await handleTicketPaymentIntentSucceeded(admin, event);
        }
        break;
      }
      case "payment_intent.payment_failed": {
        if (isCreditPurchaseIntentEvent(event)) {
          await handleCreditPurchaseIntentFailed(admin, event);
        } else {
          await handleTicketPaymentIntentFailed(admin, event);
        }
        break;
      }
      default:
        break;
    }
    return;
  }
  switch (event.type) {
    case "account.updated":
      // Also handled when delivered on the platform endpoint (single-endpoint
      // configurations) — same mirror, same unknown-account no-op.
      await handleConnectAccountUpdated(admin, event);
      break;
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id ?? null;
      if (!subscriptionId) break;

      // Business checkout sessions always carry place_id metadata;
      // consumer ones carry consumer_id (or client_reference_id).
      const placeId =
        (session.metadata?.place_id as string | undefined) ?? null;
      if (placeId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        await reconcilePlaceSubscription(admin, placeId, sub);
        break;
      }

      const consumerId =
        session.client_reference_id ??
        (session.metadata?.consumer_id as string | undefined) ??
        null;
      if (consumerId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        await reconcileConsumerSubscription(admin, consumerId, sub);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;

      const placeId =
        (sub.metadata?.place_id as string | undefined) ??
        (await resolvePlaceId(admin, sub));
      if (placeId) {
        await reconcilePlaceSubscription(admin, placeId, sub);
        break;
      }

      const consumerId = await resolveConsumerId(admin, stripe, sub);
      if (consumerId) {
        await reconcileConsumerSubscription(admin, consumerId, sub);
      }
      break;
    }
    default:
      // Unhandled event types are acknowledged and ignored.
      break;
  }
}

// ─── Consumer side ──────────────────────────────────────────────────────────

// Upserts the local subscription mirror and applies the tier side-effect.
async function reconcileConsumerSubscription(
  admin: ReturnType<typeof adminClient>,
  consumerId: string,
  sub: Stripe.Subscription,
): Promise<void> {
  const { localState, customerId, periodEnd, priceCents, currency, isLive } =
    subscriptionSnapshot(sub);

  if (isLive) {
    // Keep the one-live invariant: retire any OTHER live row for this consumer
    // (e.g. a leftover mock_<consumerId> row from the demo toggle) so the
    // incoming subscription can't collide with consumer_subscriptions_one_live.
    const retire = await admin
      .from("consumer_subscriptions")
      .update({ state: "canceled" })
      .eq("consumer_id", consumerId)
      .neq("stripe_subscription_id", sub.id)
      .in("state", ["active", "past_due"]);
    if (retire.error) {
      throw new Error(`consumer_retire_prior_live: ${retire.error.message}`);
    }
  }

  const mirror = await admin
    .from("consumer_subscriptions")
    .upsert(
      {
        consumer_id: consumerId,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        state: localState,
        price_cents: priceCents,
        currency,
        current_period_end: periodEnd,
        cancel_at_period_end: sub.cancel_at_period_end ?? false,
      },
      { onConflict: "stripe_subscription_id" },
    );
  if (mirror.error) {
    throw new Error(`consumer_subscription_mirror: ${mirror.error.message}`);
  }

  // The paid-door fact is the mirror row above; plan is derived. The shared
  // recompute writes consumers.plan from the live sub and the class slot from
  // the highest-ranked open CLASS door. Throws propagate → 500 → Stripe retries.
  await recomputeConsumerClass(admin, consumerId);
}

// ─── Business side ──────────────────────────────────────────────────────────

// Upserts the place's subscription mirror and applies the plan side-effect.
async function reconcilePlaceSubscription(
  admin: ReturnType<typeof adminClient>,
  placeId: string,
  sub: Stripe.Subscription,
): Promise<void> {
  const { localState, customerId, periodEnd, priceCents, currency, isLive } =
    subscriptionSnapshot(sub);

  const planKey = await resolvePlanKey(admin, sub);
  if (!planKey) {
    console.error(
      `[stripe-webhook-handle-event] no plan_key resolvable for subscription ${sub.id} (place ${placeId})`,
    );
    return;
  }

  if (isLive) {
    // Keep the one-live invariant: retire any OTHER live row for this place
    // (e.g. a leftover mock_<placeId> row from the demo toggle) so the
    // incoming subscription can't collide with place_subscriptions_one_live.
    const retire = await admin
      .from("place_subscriptions")
      .update({ state: "canceled" })
      .eq("place_id", placeId)
      .neq("stripe_subscription_id", sub.id)
      .in("state", ["active", "past_due"]);
    if (retire.error) {
      throw new Error(`place_retire_prior_live: ${retire.error.message}`);
    }
  }

  const mirror = await admin
    .from("place_subscriptions")
    .upsert(
      {
        place_id: placeId,
        plan_key: planKey,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        state: localState,
        price_cents: priceCents,
        currency,
        current_period_end: periodEnd,
        cancel_at_period_end: sub.cancel_at_period_end ?? false,
      },
      { onConflict: "stripe_subscription_id" },
    );
  if (mirror.error) {
    throw new Error(`place_subscription_mirror: ${mirror.error.message}`);
  }

  if (isLive) {
    const { data: row, error: readErr } = await admin
      .from("places")
      .select(
        "listing_type, welcome_free_rate, welcome_premium_rate, free_rate, premium_rate",
      )
      .eq("id", placeId)
      .maybeSingle();
    if (readErr) throw new Error(`place_read: ${readErr.message}`);
    if (!row) throw new Error(`place_not_found: ${placeId}`);

    const patch: Record<string, unknown> = { plan: planKey };
    applyListingTypeToPatch(patch, {
      plan: planKey,
      rates: ratesFromPlace(row as Record<string, unknown>),
      currentListingType: (row as Record<string, unknown>).listing_type as string,
    });

    const grant = await writePlace(admin, {
      table: "places",
      mode: "update",
      id: placeId,
      patch: patch as PlacePatch,
    });
    if (!grant.ok) throw new Error(`place_grant: ${grant.error}`);
  } else {
    const { data: row, error: readErr } = await admin
      .from("places")
      .select(
        "plan, listing_type, welcome_free_rate, welcome_premium_rate, free_rate, premium_rate",
      )
      .eq("id", placeId)
      .maybeSingle();
    if (readErr) throw new Error(`place_read: ${readErr.message}`);
    if (!row) return;

    const current = row as Record<string, unknown>;
    if ((current.plan as string) !== planKey) return;

    const patch: Record<string, unknown> = { plan: "free" };
    applyListingTypeToPatch(patch, {
      plan: "free",
      rates: ratesFromPlace(current),
      currentListingType: current.listing_type as string,
    });
    patch.plan_live_at = null;
    patch.first_ticket_honored_at = null;

    // Guard: only revoke if the plan is still what we read above — a
    // concurrent change (another webhook, a manual admin grant) must win.
    const revoke = await writePlace(admin, {
      table: "places",
      mode: "update",
      id: placeId,
      patch: patch as PlacePatch,
      guard: { plan: planKey },
    });
    if (!revoke.ok) throw new Error(`place_revoke: ${revoke.error}`);
  }
}
