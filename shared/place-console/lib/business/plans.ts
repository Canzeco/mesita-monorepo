// Promos v4 (MESITA-541), ratified 2026-08-21 (MESITA-1154): a place is
// either Free or holds the Partnership subscription (MX$1,000 + IVA/year).
// Verified is a SEPARATE, free ownership fact (resolvePlaceVerification in
// place-utils.ts) — never conflate the two. Discount Strategies (Zero /
// Conservative / Aggressive) live on the Promos page and are NOT separate
// Stripe products — paid Strategies all grant the same Partnership
// (`plan=pro`). Legacy `ultra` folds onto it for display.
//
// THE YEARLY SKU IS BACK, AS MESITA PARTNER (MESITA-1867). Pato struck the
// paid stream on 2026-09-06 and the console spent a week saying Partner was
// free and Stripe-locked; on 2026-09-15 he put the price back. It was priced
// per ORGANIZATION for one day — every place a holder held was in — and
// MESITA-1892 deleted that layer, so the Membership is bought PER PLACE and
// `places.partnered` is the entitlement. Mesita Pay (the Stripe account) is
// an optional add-on on top, not the lock. `plan=pro` is what a place holds
// under the partnership.

// Ported with MESITA-1537 (the Place screen mounts admin's Single Place
// components). `plan` is billing, not profile: it reaches the DB through the
// paid door only — business-web-update-place rejects any body carrying it.
/** The LEGACY strategy ids the ported Controls components still speak. */
type StrategySubscriptionId = "free" | "pro_discount" | "ultra_discount";

/** The `membership` enum value a strategy maps to. */
export type PlanKey = "free" | "pro" | "ultra";

export function planForSubscription(sub: StrategySubscriptionId): PlanKey {
  if (sub === "pro_discount") return "pro";
  if (sub === "ultra_discount") return "ultra";
  return "free";
}

/**
 * Pato's number (2026-09-15): *"pon tú de mil pesos al año, súper barato."*
 *
 * THE FALLBACK, since MESITA-1877. The real number now rides the console
 * viewer's envelope off `membership_plans.membership` — the same row Stripe's
 * price is provisioned from, so what an owner reads is what Stripe bills.
 * This constant is what `membershipPriceLabel` prints when that read is
 * missing: an older payload, or a billing read that failed. A price box with
 * no price would be worse than a stale one, and the two have not differed
 * since the row was seeded at this number.
 */
export const PARTNER_PRICE_LABEL = {
  amount: "MX$1,000",
  suffix: "+ IVA a year",
} as const;

/**
 * The price as the console prints it, from the catalog when the payload
 * carried one.
 *
 * The SUFFIX is not billing data and never comes off the wire: "a year" is
 * the catalog entry's interval, fixed in code, and IVA is a fact about
 * selling in Mexico, not a Stripe field. Only the amount can move, so only
 * the amount is read.
 */
export function membershipPriceLabel(
  price: { priceCents: number; currency: string } | null | undefined,
): { amount: string; suffix: string } {
  if (!price || !Number.isFinite(price.priceCents)) return PARTNER_PRICE_LABEL;
  const pesos = price.priceCents / 100;
  // Whole pesos when it is whole — "MX$1,000.00" on a round yearly price
  // reads as a receipt, not a price tag.
  const amount = Number.isInteger(pesos)
    ? pesos.toLocaleString("en-US")
    : pesos.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const prefix = price.currency === "MXN" ? "MX$" : `${price.currency} `;
  return { amount: `${prefix}${amount}`, suffix: PARTNER_PRICE_LABEL.suffix };
}
