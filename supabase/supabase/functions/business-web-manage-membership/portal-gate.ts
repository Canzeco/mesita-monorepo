// Is there anything in Stripe to manage? (MESITA-1891)
//
// THE QUESTION IS ABOUT THE PLACE, NOT ABOUT THE ENVIRONMENT. The first cut
// short-circuited on `MOCK_SUBSCRIPTION || !stripeKey` — it asked the flag and
// never the row. That is safe in exactly one direction and wrong in the other:
//
//   flag on, no real subscription   → mock answer. Correct either way.
//   flag on, REAL subscription      → mock answer, and the owner is told the
//                                     partnership is not billed through
//                                     Stripe in this environment. Stripe goes
//                                     on charging them yearly, and this is
//                                     the ONLY cancel path in the product.
//
// The second row is not hypothetical. MOCK_SUBSCRIPTION is an operator's
// switch and agents never touch it (MESITA-37), so it moves by hand: a place
// buys a real Membership with the flag off, and a later demo, staging restore
// or rollback flips it back on. The subscription does not care. The row is
// what records it, so the row is what this asks.
//
// Its sibling `business-web-start-membership` already refuses to let the flag
// override the row in the mirrored direction — a leftover `mock_*` grant must
// not read as a membership on the real path, or a place that took a mock
// grant could never buy. This is the same rule pointed the other way, and it
// deliberately reuses that file's `isMockSubscriptionId` rather than
// re-deriving what a mock id looks like.
//
// The `!stripeKey` half STAYS, and stays first: with no secret there is no
// Stripe to open a portal against, whatever the row says.

import { isMockSubscriptionId } from "../_shared/partner-membership.ts";

/** The `partner_memberships` fields this decision reads — a structural subset
 *  of `PartnerMembershipRow`, so `readLiveMembership`'s row passes as-is. */
export type PortalMembership = { stripe_subscription_id: string | null };

/**
 * True ⇒ answer `{ url: null, mock: true }` and call Stripe zero times.
 * False ⇒ there is a real subscription behind this place; open the portal.
 *
 * @param stripeKey    the resolved secret, or null/empty when unconfigured.
 * @param live         the place's LIVE membership row (active | past_due), or
 *                     null when it has none. Null is a mock answer: there is
 *                     genuinely nothing to manage, which is also what a place
 *                     that never bought anything should hear.
 */
export function membershipPortalIsMock(
  stripeKey: string | null | undefined,
  live: PortalMembership | null,
): boolean {
  if (!stripeKey) return true;
  if (!live) return true;
  // A live row with no subscription id is not something Stripe can open
  // either — `readLiveMembership` should never hand one back (an `incomplete`
  // mirror is outside the two live states), and if it ever did, sending null
  // to `billingPortal.sessions.create` is worse than the mock sentence.
  if (!live.stripe_subscription_id) return true;
  return isMockSubscriptionId(live.stripe_subscription_id);
}
