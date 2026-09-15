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
  MEMBERSHIP_PLAN_KEY,
  membershipOutcome,
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

/**
 * Upserts the organization's membership mirror and applies the entitlement
 * its state implies. Throws on a write failure so the caller 500s and Stripe
 * retries — the same contract the place and consumer reconcilers keep.
 */
export async function reconcilePartnerMembership(
  admin: ReturnType<typeof adminClient>,
  orgId: string,
  sub: Stripe.Subscription,
): Promise<void> {
  const { localState, customerId, periodEnd, priceCents, currency, isLive } =
    subscriptionSnapshot(sub);

  if (isLive) {
    // Keep the one-live invariant: retire any OTHER live row for this
    // organization (typically a leftover `mock_<orgId>` row from the demo
    // toggle) so the incoming subscription cannot collide with
    // partner_memberships_one_live.
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

  const outcome = membershipOutcome(localState);
  const applied = await applyMembershipEntitlement(admin, orgId, outcome);
  if (!applied.ok) throw new Error(`membership_entitlement: ${applied.error}`);
}
