// Plan helpers for admin Promos (set-plan mapping).
// Visibility ladder / subscription catalog UI moved to strategies.ts
// (STRATEGY_VISIBILITY_LADDER) — dead locals removed 2026-07 (MESITA-722).

export type SubscriptionId = "free" | "pro_discount" | "ultra_discount";

/** The `membership` enum value a strategy maps to. */
export type PlanKey = "free" | "pro" | "ultra";

/**
 * The plan a strategy grants. Goes to admin-web-set-plan, NOT into a
 * business-web-update-project patch — that EF rejects any body carrying a
 * `plan` key (plan is billing, not profile).
 */
export function planForSubscription(sub: SubscriptionId): PlanKey {
  if (sub === "pro_discount") return "pro";
  if (sub === "ultra_discount") return "ultra";
  return "free";
}
