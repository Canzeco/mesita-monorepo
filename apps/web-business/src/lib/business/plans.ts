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
// free and Stripe-locked; on 2026-09-15 he put the price back at the
// ORGANIZATION: Mesita Partner is a yearly subscription per organization,
// every held place is in, and Mesita Pay (the Stripe account) is an optional
// add-on on top — not the lock. `plan=pro` is what a place holds under it.

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
 * The ONE source both the Partner box and its modal print — two renderings
 * of a price that can drift is a price list that lies in one of them. It is
 * a label, not a value: nothing charges off it. To be replaced by
 * `place_plans.pro.price_cents` on the organizations payload when MESITA-1868
 * ships the checkout, so the number the owner reads is the number Stripe
 * bills.
 */
export const PARTNER_PRICE_LABEL = {
  amount: "MX$1,000",
  suffix: "+ IVA a year",
} as const;
