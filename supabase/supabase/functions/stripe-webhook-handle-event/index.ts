// Supabase Edge Function — stripe-webhook-handle-event (external caller)
//
// Public endpoint (verify_jwt disabled at the gateway). Security rests
// entirely on Stripe signature verification with STRIPE_WEBHOOK_SECRET — an
// unsigned or mis-signed request is rejected.
//
// One endpoint, two billing surfaces, discriminated by metadata:
//   • consumer_id  → consumer Premium ($100 MXN/mo). The ONLY writer that
//     flips a consumer to/from Premium on the back of the paid door.
//   • project_id   → place plans (Pro/Ultra). The ONLY writer that flips
//     projects.plan on the back of the paid door.
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
import { STRIPE_API_VERSION } from "../_shared/stripe-billing.ts";
import {
  resolveConsumerId,
  resolvePlanKey,
  resolveProjectId,
} from "./subscription-resolve.ts";
import { subscriptionSnapshot } from "./subscription-snapshot.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const envRes = readEFEnv();
  if (!envRes.ok) return new Response("Server misconfigured", { status: 500 });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    return new Response("Stripe not configured", { status: 500 });
  }
  const stripe = new Stripe(stripeKey, { apiVersion: STRIPE_API_VERSION });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook-handle-event] signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
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
    return new Response("Handler error", { status: 500 });
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
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id ?? null;
      if (!subscriptionId) break;

      // Business checkout sessions always carry project_id metadata;
      // consumer ones carry consumer_id (or client_reference_id).
      const projectId =
        (session.metadata?.project_id as string | undefined) ?? null;
      if (projectId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        await reconcileProjectSubscription(admin, projectId, sub);
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

      const projectId =
        (sub.metadata?.project_id as string | undefined) ??
        (await resolveProjectId(admin, sub));
      if (projectId) {
        await reconcileProjectSubscription(admin, projectId, sub);
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
  const { localStatus, customerId, periodEnd, priceCents, currency, isLive } =
    subscriptionSnapshot(sub);

  if (isLive) {
    // Keep the one-live invariant: retire any OTHER live row for this consumer
    // (e.g. a leftover mock_<consumerId> row from the demo toggle) so the
    // incoming subscription can't collide with consumer_subscriptions_one_live.
    const retire = await admin
      .from("consumer_subscriptions")
      .update({ status: "canceled" })
      .eq("consumer_id", consumerId)
      .neq("stripe_subscription_id", sub.id)
      .in("status", ["active", "past_due"]);
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
        status: localStatus,
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

  if (isLive) {
    // Grant Premium via the subscription door — but never downgrade a
    // higher-ranked earned class (Influencer/Aura ride on instagram/invitation
    // origins, both rank above Premium). The subscription mirror above is
    // always recorded; if reach later lapses, claim-instagram's fallback lands
    // the paying consumer on premium, not standard.
    const grant = await admin
      .from("consumers")
      .update({
        class_key: "premium",
        class_origin: "subscription",
        class_granted_at: new Date().toISOString(),
        class_expires_at: periodEnd,
      })
      .eq("id", consumerId)
      .in("class_origin", ["default", "subscription"]);
    if (grant.error) throw new Error(`consumer_grant: ${grant.error.message}`);
  } else {
    // Lapsed/cancelled: only downgrade if Premium came through the paid door.
    // An Instagram/invitation Premium is left untouched.
    const revoke = await admin
      .from("consumers")
      .update({
        class_key: "standard",
        class_origin: "default",
        class_expires_at: null,
      })
      .eq("id", consumerId)
      .eq("class_origin", "subscription");
    if (revoke.error) throw new Error(`consumer_revoke: ${revoke.error.message}`);
  }
}

// ─── Business side ──────────────────────────────────────────────────────────

// Upserts the project's subscription mirror and applies the plan side-effect.
async function reconcileProjectSubscription(
  admin: ReturnType<typeof adminClient>,
  projectId: string,
  sub: Stripe.Subscription,
): Promise<void> {
  const { localStatus, customerId, periodEnd, priceCents, currency, isLive } =
    subscriptionSnapshot(sub);

  const planKey = await resolvePlanKey(admin, sub);
  if (!planKey) {
    console.error(
      `[stripe-webhook-handle-event] no plan_key resolvable for subscription ${sub.id} (project ${projectId})`,
    );
    return;
  }

  if (isLive) {
    // Keep the one-live invariant: retire any OTHER live row for this project
    // (e.g. a leftover mock_<projectId> row from the demo toggle) so the
    // incoming subscription can't collide with project_subscriptions_one_live.
    const retire = await admin
      .from("project_subscriptions")
      .update({ status: "canceled" })
      .eq("project_id", projectId)
      .neq("stripe_subscription_id", sub.id)
      .in("status", ["active", "past_due"]);
    if (retire.error) {
      throw new Error(`project_retire_prior_live: ${retire.error.message}`);
    }
  }

  const mirror = await admin
    .from("project_subscriptions")
    .upsert(
      {
        project_id: projectId,
        plan_key: planKey,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        status: localStatus,
        price_cents: priceCents,
        currency,
        current_period_end: periodEnd,
        cancel_at_period_end: sub.cancel_at_period_end ?? false,
      },
      { onConflict: "stripe_subscription_id" },
    );
  if (mirror.error) {
    throw new Error(`project_subscription_mirror: ${mirror.error.message}`);
  }

  if (isLive) {
    // Grant the paid plan.
    const grant = await admin
      .from("projects")
      .update({ plan: planKey })
      .eq("id", projectId);
    if (grant.error) throw new Error(`project_grant: ${grant.error.message}`);
  } else {
    // Lapsed/cancelled: only lower the plan when it matches what this
    // subscription was paying for. A plan granted through another door
    // (admin, partnership) is left untouched.
    const revoke = await admin
      .from("projects")
      .update({ plan: "free" })
      .eq("id", projectId)
      .eq("plan", planKey);
    if (revoke.error) throw new Error(`project_revoke: ${revoke.error.message}`);
  }
}

