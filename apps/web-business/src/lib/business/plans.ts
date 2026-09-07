// Promos v4 (MESITA-541), ratified 2026-08-21 (MESITA-1154): a place is
// either Free or holds the Partnership subscription (MX$1,000 + IVA/year).
// Verified is a SEPARATE, free ownership fact (resolvePlaceVerification in
// place-utils.ts) — never conflate the two. Discount Strategies (Zero /
// Conservative / Aggressive) live on the Promos page and are NOT separate
// Stripe products — paid Strategies all grant the same Partnership
// (`plan=pro`). Legacy `ultra` folds onto it for display.

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
