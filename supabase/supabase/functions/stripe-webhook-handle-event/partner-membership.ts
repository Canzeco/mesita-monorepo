// The webhook's organization surface — Mesita Membership (MESITA-1877).
//
// Stripe is the only thing that may turn an organization into a paying
// Partner: `business-web-start-membership` opens a Checkout Session and
// entitles NOTHING, and this file is what runs when the money actually
// arrives. The one exception is MOCK_SUBSCRIPTION, where no Stripe event will
// ever come and the EF entitles inline.
//
// Routed by `metadata.organization_id`, set on both the session and the
// subscription so the renewal a year from now still knows whose it is.
//
// The mirror is written for EVERY state; the entitlement follows
// `membershipOutcome` (partner-membership.ts), which is where LAPSE ≠ DROP
// lives: `past_due` keeps the partnership and touches no place, because a
// declined yearly MX card must not null four rate columns and the monthly cap
// on every place an organization holds.

import type Stripe from "npm:stripe@17";
import type { adminClient } from "../_shared/auth.ts";
import {
  applyMembershipEntitlement,
  isMockSubscriptionId,
  MEMBERSHIP_PLAN_KEY,
  membershipOutcome,
  readLiveMembership,
} from "../_shared/partner-membership.ts";
import { subscriptionSnapshot } from "./subscription-snapshot.ts";

/** The organization a Stripe object belongs to, or null when it is not a
 *  Membership at all. Metadata only — there is no id to fall back on, and
 *  guessing from the customer would let a place subscription land here. */
export function organizationIdFor(
  obj: Stripe.Checkout.Session | Stripe.Subscription,
): string | null {
  const id = obj.metadata?.organization_id;
  return typeof id === "string" && id.length > 0 ? id : null;
}



/** The Stripe statuses that still bill. `trialing` is here and `unpaid` is
 *  not, deliberately: a trial is a live agreement, an unpaid one has run out
 *  of retries. */
const BILLABLE_STRIPE_STATUSES = ["active", "trialing", "past_due"] as const;

/**
 * Does this organization still hold a DIFFERENT live subscription at Stripe?
 *
 * The authority of last resort for a revoke. The mirror is the cheap answer
 * and it is right in the ordinary ordering; this one is right in every
 * ordering, because Stripe is where the subscriptions actually are.
 *
 * Matched on `metadata.organization_id`, not on the customer alone: one
 * customer could one day hold something else, and revoking a partnership
 * because of an unrelated subscription would be the same class of mistake in
 * the opposite direction.
 *
 * A FAILED READ THROWS. Answering "no other subscription" because Stripe was
 * briefly unreachable would null four rate columns and the monthly cap on
 * every place an organization holds. The webhook 500s and Stripe retries,
 * which costs a few minutes of a stale `partnered` flag — the cheaper error
 * by a wide margin.
 */
async function orgHasAnotherLiveSubscription(
  stripe: Stripe,
  sub: Stripe.Subscription,
  orgId: string,
): Promise<boolean> {
  const customerId = typeof sub.customer === "string"
    ? sub.customer
    : sub.customer?.id ?? null;
  // A mock customer has nothing at Stripe to ask about.
  if (!customerId || isMockSubscriptionId(customerId)) return false;

  for (const status of BILLABLE_STRIPE_STATUSES) {
    const page = await stripe.subscriptions.list({
      customer: customerId,
      status,
      limit: 100,
    });
    const other = page.data.some((s) =>
      s.id !== sub.id && s.metadata?.organization_id === orgId
    );
    if (other) return true;
  }
  return false;
}

/** Stripe statuses that can no longer bill anyone. Cancelling one of these
 *  is not a no-op — Stripe rejects it — so they are the skip list. */
const DEAD_STRIPE_STATUSES = new Set(["canceled", "incomplete_expired"]);

/** True for the two ways Stripe says "there is nothing here to cancel": the
 *  object is gone, or it is already canceled. Both mean the goal is already
 *  met, which is the only reading that makes a RETRY safe. */
function nothingLeftToCancel(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (e?.code === "resource_missing") return true;
  return /already\s+canceled/i.test(e?.message ?? "");
}

/**
 * Cancels a superseded subscription, idempotently.
 *
 * THE RETRY IS THE WHOLE REASON THIS IS NOT ONE LINE. A cancel that succeeds
 * and is then followed by a failed write 500s, and Stripe redelivers the
 * event — at which point a second `cancel` on an already-canceled
 * subscription is an ERROR, not a no-op. Rethrowing it would wedge the
 * reconcile forever: the mirror never retires, the new membership never
 * upserts, and every redelivery fails the same way.
 *
 * So: read the live object first and skip a status that cannot bill, and
 * treat both of Stripe's "nothing to cancel" answers as success. Anything
 * else still throws — a subscription we failed to cancel for a real reason is
 * a second yearly charge, and that is worth the retry.
 */
async function cancelIfStillBillable(
  stripe: Stripe,
  subscriptionId: string,
): Promise<void> {
  let prior: Stripe.Subscription | null = null;
  try {
    prior = await stripe.subscriptions.retrieve(subscriptionId);
  } catch (err) {
    if (nothingLeftToCancel(err)) return;
    throw new Error(
      `membership_read_prior_stripe (${subscriptionId}): ${String(err)}`,
    );
  }
  if (prior && DEAD_STRIPE_STATUSES.has(prior.status)) return;

  try {
    await stripe.subscriptions.cancel(subscriptionId);
  } catch (err) {
    if (nothingLeftToCancel(err)) return;
    throw new Error(
      `membership_cancel_prior_live (${subscriptionId}): ${String(err)}`,
    );
  }
}

/**
 * Upserts the organization's membership mirror and applies the entitlement
 * its state implies. Throws on a write failure so the caller 500s and Stripe
 * retries — the same contract the place and consumer reconcilers keep.
 */
export async function reconcilePartnerMembership(
  admin: ReturnType<typeof adminClient>,
  stripe: Stripe,
  orgId: string,
  sub: Stripe.Subscription,
): Promise<void> {
  const { localState, customerId, periodEnd, priceCents, currency, isLive } =
    subscriptionSnapshot(sub);

  if (isLive) {
    // Keep the one-live invariant: retire any OTHER live row for this
    // organization so the incoming subscription cannot collide with
    // partner_memberships_one_live.
    //
    // RETIRING THE MIRROR IS NOT ENOUGH WHEN THE OTHER ROW IS REAL. Stripe
    // redirects the browser home the instant a session completes, while this
    // webhook arrives on its own connection — so an owner who pays, lands back
    // on a page that still shows the price, and pays again ends up with TWO
    // live Stripe subscriptions. Marking one row canceled would hide the
    // second from the console and bill it every year regardless. So the
    // superseded subscription is cancelled AT STRIPE first, and only a
    // successful cancel (or a subscription Stripe says is already gone) lets
    // the mirror be retired: a silent failure here is a double charge that
    // renews forever, which is the one outcome worth a 500 and a retry.
    // `mock_*` ids are not Stripe subscriptions and are retired directly.
    const { data: priors, error: priorErr } = await admin
      .from("partner_memberships")
      .select("stripe_subscription_id")
      .eq("organization_id", orgId)
      .neq("stripe_subscription_id", sub.id)
      .in("state", ["active", "past_due"]);
    if (priorErr) {
      throw new Error(`membership_read_prior_live: ${priorErr.message}`);
    }

    for (const row of (priors ?? []) as { stripe_subscription_id: string }[]) {
      const priorId = row.stripe_subscription_id;
      if (isMockSubscriptionId(priorId)) continue;
      await cancelIfStillBillable(stripe, priorId);
    }

    const retire = await admin
      .from("partner_memberships")
      .update({ state: "canceled" })
      .eq("organization_id", orgId)
      .neq("stripe_subscription_id", sub.id)
      .in("state", ["active", "past_due"]);
    if (retire.error) {
      throw new Error(`membership_retire_prior_live: ${retire.error.message}`);
    }
  }

  const mirror = await admin
    .from("partner_memberships")
    .upsert(
      {
        organization_id: orgId,
        plan_key: MEMBERSHIP_PLAN_KEY,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        state: localState,
        price_cents: priceCents,
        currency,
        current_period_end: periodEnd,
        cancel_at_period_end: sub.cancel_at_period_end ?? false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_id" },
    );
  if (mirror.error) {
    throw new Error(`membership_mirror: ${mirror.error.message}`);
  }

  // The organization anchors the customer it pays as, so a lapsed member who
  // re-subscribes keeps one billing history. Only fills a hole — never
  // overwrites an anchor, and never accepts a mock id as one.
  if (customerId && !customerId.startsWith("mock_")) {
    await admin
      .from("organizations")
      .update({ stripe_billing_customer_id: customerId })
      .eq("id", orgId)
      .is("stripe_billing_customer_id", null);
  }

  // THE ENTITLEMENT ANSWERS TO THE ORGANIZATION, NOT TO THIS ONE EVENT.
  //
  // Cancelling a superseded subscription above makes Stripe emit
  // `customer.subscription.deleted` for it, and that event arrives back here
  // carrying the same `organization_id`. Read alone, its state says revoke —
  // so the org would lose `partnered` and every held place would be dropped
  // at the exact moment it had just paid twice. And `joinPlacePatch` does not
  // undo that: the replacement's entitle writes `plan=pro` at ZERO, so the
  // rates and the monthly cap the operator configured are gone for good. A
  // double-payment repair would become a permanent outage.
  //
  // So a revoke has to survive TWO questions, because the two events race and
  // neither ordering may drop a paying organization:
  //
  //   the mirror   Is another membership row still live? This answers the
  //                ordinary ordering, where the replacement was upserted
  //                before the cancellation event came back.
  //   Stripe       Does the customer still hold another subscription for this
  //                organization? This answers the INVERTED ordering — the
  //                deleted event overtaking the upsert — which the mirror
  //                cannot see, because in that window the prior is already
  //                retired and the replacement is not written yet. The two
  //                arrive as separate HTTP requests with different event ids,
  //                so `stripe_events` does not serialize them.
  //
  // Stripe is asked only when the cheap answer is "nothing left", which is
  // the revocation path alone — never on the renewals that make up almost
  // every delivery.
  let outcome = membershipOutcome(localState);
  if (outcome === "revoke") {
    const remaining = await readLiveMembership(admin, orgId);
    if (!remaining.ok) {
      throw new Error(`membership_read_remaining: ${remaining.error}`);
    }
    if (remaining.row) {
      outcome = "mirror";
    } else if (await orgHasAnotherLiveSubscription(stripe, sub, orgId)) {
      outcome = "mirror";
    }
  }

  const applied = await applyMembershipEntitlement(admin, orgId, outcome);
  if (!applied.ok) throw new Error(`membership_entitlement: ${applied.error}`);
}
