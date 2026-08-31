// Promotion score — how much a place offers through Mesita, as ONE number
// (Pato gate 2026-08-29). Partnership is the first step, then every offering
// adds: Visit Rewards level (0|1|2) and one point per accepted rail. Mesita
// Capital raises the max when it exists.
//
// DISPLAY-ONLY, derived, never stored. It expresses offering completeness to
// operators (the Partner tab's Promos bar, the catalog's Promotion column).
// It must NEVER feed discovery ranking — "Rank is never for sale" and the
// Lineup signals' "never a bought score" stay law (discovery-signals.ts).
//
// Twin: apps/web-admin/src/lib/business/promotion-score.ts — keep in lockstep.

export const PROMOTION_SCORE_MAX = 7;

export type PromotionParts = {
  /** Paid plan (isPaidPlan) — the first step. */
  partner: boolean;
  /** Live Visit Rewards ladder level. Engine 0–3 accepted; operator display
   *  is 0|1|2, so Dominant (3) clamps to 2 — same collapse as
   *  operatorPromotingLevel on the web side. */
  visitRewardsLevel: number;
  /** places.mesita_pay_enabled — accepts the Mesita Pay card rail. */
  mesitaPay: boolean;
  /** places.credits_enabled — accepts Mesita Credits. */
  credits: boolean;
  /** places.pickup_orders_enabled — offers pickup orders. */
  pickup: boolean;
  /** places.delivery_orders_enabled — offers delivery orders. */
  delivery: boolean;
};

/** 0…PROMOTION_SCORE_MAX. Partner +1 · Visit Rewards +0/1/2 · each rail +1. */
export function promotionScore(parts: PromotionParts): number {
  const raw = typeof parts.visitRewardsLevel === "number" &&
      Number.isFinite(parts.visitRewardsLevel)
    ? Math.trunc(parts.visitRewardsLevel)
    : 0;
  const level = Math.min(2, Math.max(0, raw));
  return (parts.partner ? 1 : 0) + level +
    (parts.mesitaPay ? 1 : 0) + (parts.credits ? 1 : 0) +
    (parts.pickup ? 1 : 0) + (parts.delivery ? 1 : 0);
}
