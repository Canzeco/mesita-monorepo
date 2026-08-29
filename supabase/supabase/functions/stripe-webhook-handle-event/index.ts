// Supabase Edge Function — stripe-webhook-handle-event (external caller)
//
// Public endpoint (verify_jwt disabled at the gateway). Security rests
// entirely on Stripe signature verification — an unsigned or mis-signed
// request is rejected. TWO signing secrets serve the one URL: the platform
// endpoint's STRIPE_WEBHOOK_SECRET, and STRIPE_CONNECT_WEBHOOK_SECRET once
// the operator creates the Connect endpoint (same URL, enabled_events pinned
// to ["account.updated"]) — see webhook-verify.ts.
//
// One endpoint, three surfaces:
//   • consumer_id  → consumer Premium ($50 MXN/mo). The ONLY writer that
//     flips a consumer to/from Premium on the back of the paid door.
//   • project_id   → place plans (Verified / plan=pro; ultra legacy). The ONLY writer that flips
//     projects.plan on the back of the paid door.
//   • Connect account.updated → place_payment_accounts mirror (PLATFORM
//     account layer, connect-account.ts). Connect-DELIVERED events (top-level
//     event.account set) are guarded to account.updated ONLY: a restaurant's
//     own Stripe subscriptions must never enter the platform reconcilers.
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
  resolveConsumerId,
  resolvePlanKey,
  resolveProjectId,
} from "./subscription-resolve.ts";
import {
  applyListingTypeToPatch,
} from "../_shared/partner-derivation.ts";
import { recomputeConsumerClass } from "../_shared/class-doors.ts";
import { type ProjectPatch, writePlace } from "../_shared/place-doc.ts";
import { ratesFromPlace } from "../_shared/promo-strategy.ts";
import { subscriptionSnapshot } from "./subscription-snapshot.ts";
import { verifyStripeEvent } from "./webhook-verify.ts";
import { handleConnectAccountUpdated } from "./connect-account.ts";

Deno.serve(async (req) => {
  // Vendor webhook — no CORS preflight; POST-only.
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    return jsonError("Stripe not configured", 500);
  }
  const stripe = new Stripe(stripeKey, { apiVersion: STRIPE_API_VERSION });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return jsonError("Missing signature", 400);

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await verifyStripeEvent(stripe, raw, sig, [
      webhookSecret,
      Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET"),
    ]);
  } catch (err) {
    console.error("[stripe-webhook-handle-event] signature verification failed:", err);
    return jsonError("Invalid signature", 400);
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
  // Connect-DELIVERED events (top-level event.account) are guarded to the one
  // type the Connect endpoint exists for. Anything else a mis-configured
  // endpoint subscribes (e.g. a restaurant's own customer.subscription.*)
  // is acknowledged and ignored — it must never reach the platform
  // subscription reconcilers below.
  if (typeof event.account === "string" && event.account.length > 0) {
    if (event.type === "account.updated") {
      await handleConnectAccountUpdated(admin, event);
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

  // The paid-door fact is the mirror row above; plan is derived. The shared
  // recompute writes consumers.plan from the live sub and the class slot from
  // the highest-ranked open CLASS door. Throws propagate → 500 → Stripe retries.
  await recomputeConsumerClass(admin, consumerId);
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
      .eq("place_id", projectId)
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
        place_id: projectId,
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
    const { data: row, error: readErr } = await admin
      .from("projects")
      .select(
        "listing_type, welcome_free_rate, welcome_premium_rate, free_rate, premium_rate",
      )
      .eq("id", projectId)
      .maybeSingle();
    if (readErr) throw new Error(`project_read: ${readErr.message}`);
    if (!row) throw new Error(`project_not_found: ${projectId}`);

    const patch: Record<string, unknown> = { plan: planKey };
    applyListingTypeToPatch(patch, {
      plan: planKey,
      rates: ratesFromPlace(row as Record<string, unknown>),
      currentListingType: (row as Record<string, unknown>).listing_type as string,
    });

    const grant = await writePlace(admin, {
      table: "projects",
      mode: "update",
      id: projectId,
      patch: patch as ProjectPatch,
    });
    if (!grant.ok) throw new Error(`project_grant: ${grant.error}`);
  } else {
    const { data: row, error: readErr } = await admin
      .from("projects")
      .select(
        "plan, listing_type, welcome_free_rate, welcome_premium_rate, free_rate, premium_rate",
      )
      .eq("id", projectId)
      .maybeSingle();
    if (readErr) throw new Error(`project_read: ${readErr.message}`);
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
      table: "projects",
      mode: "update",
      id: projectId,
      patch: patch as ProjectPatch,
      guard: { plan: planKey },
    });
    if (!revoke.ok) throw new Error(`project_revoke: ${revoke.error}`);
  }
}
