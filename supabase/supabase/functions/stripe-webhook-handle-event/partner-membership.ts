// The webhook's Membership surface — Mesita Membership (MESITA-1877,
// re-scoped to the PLACE by MESITA-1892).
//
// Stripe is the only thing that may turn a place into a paying Partner:
// `business-web-start-membership` opens a Checkout Session and entitles
// NOTHING, and this file is what runs when the money actually arrives. The one
// exception is MOCK_SUBSCRIPTION, where no Stripe event will ever come and the
// EF entitles inline.
//
// ROUTING CHANGED SHAPE, NOT JUST NAMES. A Membership used to be the one
// business object stamped with an organization's id and no place id, so the
// mere presence of that key was the routing test. Now a Membership carries a
// place id — and so does the older per-place Verified subscription
// (business-web-change-subscription). Presence of an id can no longer tell
// them apart, so `membershipRouteFor` asks WHAT KIND of thing this is
// (`mesita_kind` / `plan_key`) and only then whose. Getting that wrong would
// reconcile a Verified subscription as a Membership, or the reverse.
//
// The mirror is written for EVERY state; the entitlement follows
// `membershipOutcome` (_shared/partner-membership.ts), which is where
// LAPSE ≠ DROP lives: `past_due` keeps the partnership and touches nothing
// else, because a declined yearly MX card must not null four rate columns and
// the monthly cap on the place.

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

/** `metadata.mesita_kind` for a Membership. business-web-start-membership
 *  stamps this literal; EFs cannot import from each other's directories, so
 *  the second leg below (`plan_key`) is the one that comes from a shared
 *  constant and keeps the two honest. */
const MEMBERSHIP_METADATA_KIND = "business_membership";

/**
 * What a Stripe object is, and whose.
 *
 *   membership   — a Membership for `placeId`. Reconcile it.
 *   unroutable   — a Membership by kind that names no place. See below.
 *   not_membership — anything else; the caller falls through to the place-plan
 *                  and consumer branches.
 *
 * THE UNROUTABLE RUNG IS NOT HYPOTHETICAL. A yearly subscription sold before
 * MESITA-1892 was stamped with the id of the ORGANIZATION that bought it, and
 * organizations are gone. Metadata is frozen on the Stripe SUBSCRIPTION — the
 * object Stripe re-sends on every renewal, lapse and cancellation for the rest
 * of that year — and the migration rewrote our rows, not Stripe's objects. So
 * this handler will meet Memberships that name no place for up to a year.
 *
 * It is detected by ABSENCE rather than by reading the retired key, which is
 * both simpler and wider: any Membership that cannot name a place lands here,
 * whatever it does carry. There is nothing to map from either way.
 *
 * And it refuses, loudly, rather than guessing. Falling through would hand the
 * object to `resolvePlaceId`, which falls back to the CUSTOMER and could
 * reconcile a Membership onto an unrelated place's plan; picking a place out
 * of a dissolved holding is a guess about money. The caller logs the
 * subscription id and acks, which leaves the mirror untouched and the
 * partnership exactly as it stands until a human re-stamps the metadata.
 */
export type MembershipRoute =
  | { kind: "membership"; placeId: string }
  | { kind: "unroutable" }
  | { kind: "not_membership" };

function metaString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** IS THIS THING A MEMBERSHIP? One answer, two readers.
 *
 *  `membershipRouteFor` asks it of the object being handled;
 *  `placeHasAnotherLiveSubscription` asks it of every OTHER live subscription
 *  the customer holds. Those two must agree, because between them they decide
 *  whether a cancelled Membership revokes a partnership — and before
 *  MESITA-1892 they agreed for free, since a Membership was the only
 *  subscription that carried an `organization_id` at all. `place_id` is not
 *  that: the place's own Verified plan carries one too. */
function isMembershipMetadata(meta: Stripe.Metadata | null | undefined): boolean {
  const m = meta ?? {};
  return metaString(m.mesita_kind) === MEMBERSHIP_METADATA_KIND ||
    metaString(m.plan_key) === MEMBERSHIP_PLAN_KEY;
}

export function membershipRouteFor(
  obj: Stripe.Checkout.Session | Stripe.Subscription,
): MembershipRoute {
  if (!isMembershipMetadata(obj.metadata)) return { kind: "not_membership" };

  const placeId = metaString((obj.metadata ?? {}).place_id);
  return placeId ? { kind: "membership", placeId } : { kind: "unroutable" };
}


/** The Stripe statuses that still bill. `trialing` is here and `unpaid` is
 *  not, deliberately: a trial is a live agreement, an unpaid one has run out
 *  of retries. */
const BILLABLE_STRIPE_STATUSES = ["active", "trialing", "past_due"] as const;

/**
 * Does this place still hold a DIFFERENT live subscription at Stripe?
 *
 * The authority of last resort for a revoke. The mirror is the cheap answer
 * and it is right in the ordinary ordering; this one is right in every
 * ordering, because Stripe is where the subscriptions actually are.
 *
 * Matched on `metadata.place_id` AND the membership KIND, not on the customer
 * alone: one customer holds other subscriptions, and treating an unrelated one
 * as a reason to keep a partnership is the same class of mistake in the
 * opposite direction.
 *
 * THE KIND CHECK IS NOT BELT AND BRACES — it is the whole guard now.
 * This matched `metadata.organization_id` until MESITA-1892, and that key was
 * carried by Memberships and by nothing else, so "another subscription for the
 * same tenant" could only ever mean another MEMBERSHIP. Re-pointing it at
 * `place_id` silently widened it: `business-web-change-subscription` stamps
 * `{ place_id, plan_key }` on the place's own Verified plan. Without the kind
 * check, a place that holds both would answer "yes, another live subscription"
 * when its Membership is cancelled — the revoke would downgrade to a no-op and
 * the place would stay `partnered` having stopped paying for it.
 *
 * A FAILED READ THROWS. Answering "no other subscription" because Stripe was
 * briefly unreachable would null four rate columns and the monthly cap on the
 * place. The webhook 500s and Stripe retries, which costs a few minutes of a
 * stale `partnered` flag — the cheaper error by a wide margin.
 */
async function placeHasAnotherLiveSubscription(
  stripe: Stripe,
  sub: Stripe.Subscription,
  placeId: string,
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
      s.id !== sub.id &&
      metaString(s.metadata?.place_id) === placeId &&
      isMembershipMetadata(s.metadata)
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
 * Upserts the place's membership mirror and applies the entitlement its state
 * implies. Throws on a write failure so the caller 500s and Stripe retries —
 * the same contract the place-plan and consumer reconcilers keep.
 */
export async function reconcilePartnerMembership(
  admin: ReturnType<typeof adminClient>,
  stripe: Stripe,
  placeId: string,
  sub: Stripe.Subscription,
): Promise<void> {
  const { localState, customerId, periodEnd, priceCents, currency, isLive } =
    subscriptionSnapshot(sub);

  if (isLive) {
    // Keep the one-live invariant: retire any OTHER live row for this place
    // so the incoming subscription cannot collide with
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
      .eq("place_id", placeId)
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
      .eq("place_id", placeId)
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
        place_id: placeId,
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

  // The place anchors the customer it pays as, so a lapsed member who
  // re-subscribes keeps one billing history. Only fills a hole — never
  // overwrites an anchor, and never accepts a mock id as one. The
  // compare-and-set is the same race guard ensurePlaceBillingCustomer uses:
  // this door and that one fill the same column from two directions.
  if (customerId && !customerId.startsWith("mock_")) {
    await admin
      .from("places")
      .update({ stripe_billing_customer_id: customerId })
      .eq("id", placeId)
      .is("stripe_billing_customer_id", null);
  }

  // THE ENTITLEMENT ANSWERS TO THE PLACE, NOT TO THIS ONE EVENT.
  //
  // Cancelling a superseded subscription above makes Stripe emit
  // `customer.subscription.deleted` for it, and that event arrives back here
  // carrying the same `place_id`. Read alone, its state says revoke — so the
  // place would lose `partnered` and be dropped to free at the exact moment it
  // had just paid twice. And `joinPlacePatch` does not undo that: the
  // replacement's entitle writes `plan=pro` at ZERO, so the rates and the
  // monthly cap the operator configured are gone for good. A double-payment
  // repair would become a permanent outage.
  //
  // So a revoke has to survive TWO questions, because the two events race and
  // neither ordering may drop a paying place:
  //
  //   the mirror   Is another membership row still live? This answers the
  //                ordinary ordering, where the replacement was upserted
  //                before the cancellation event came back.
  //   Stripe       Does the customer still hold another subscription for this
  //                place? This answers the INVERTED ordering — the deleted
  //                event overtaking the upsert — which the mirror cannot see,
  //                because in that window the prior is already retired and the
  //                replacement is not written yet. The two arrive as separate
  //                HTTP requests with different event ids, so `stripe_events`
  //                does not serialize them.
  //
  // Stripe is asked only when the cheap answer is "nothing left", which is
  // the revocation path alone — never on the renewals that make up almost
  // every delivery.
  let outcome = membershipOutcome(localState);
  if (outcome === "revoke") {
    const remaining = await readLiveMembership(admin, placeId);
    if (!remaining.ok) {
      throw new Error(`membership_read_remaining: ${remaining.error}`);
    }
    if (remaining.row) {
      outcome = "mirror";
    } else if (await placeHasAnotherLiveSubscription(stripe, sub, placeId)) {
      outcome = "mirror";
    }
  }

  const applied = await applyMembershipEntitlement(admin, placeId, outcome);
  if (!applied.ok) throw new Error(`membership_entitlement: ${applied.error}`);
}
