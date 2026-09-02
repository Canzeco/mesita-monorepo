// Is this place PROMOTING right now — i.e. does a guest get a discount here
// at this moment (MESITA-1150)?
//
// The wire boolean that replaces `listing_type === 'partner'` on every
// consumer surface. Those two are not the same question and never were:
//
//   listing_type   stored, and derived ONLY when something writes the place
//                  (admin-web-set-plan, buildStrikePatch). It collapses
//                  "pays Mesita" AND "strategy ≠ zero" into one enum, so it
//                  can answer neither separately — and a strike-2 pause,
//                  which writes promo_paused_until and nothing else, leaves
//                  it standing over a closed promo lane. The consumer app
//                  then shows a reward badge on a place that will honor
//                  nothing.
//
//   promoting      computed at READ time from the three things that actually
//                  decide it: a paid plan, a strategy above Zero, and an open
//                  promo lane. It cannot go stale, because nothing stores it.
//
// Place state is three independent booleans — Verified (ownership proven),
// Partner (pays Mesita), Promoting (a live discount). Only the last one is
// ever shown to a guest: the first two are Mesita's business, and a badge
// that means "this restaurant pays us" tells a guest nothing they can use.

import { assessPromoLane } from "./membership-enforcement.ts";
import { isPaidPlan } from "./membership-enforcement-helpers.ts";
import { placeStrategy } from "./rewards-config.ts";

/** Everything the answer depends on. All of it stays server-side. */
export type PromotingFields = {
  plan?: string | null;
  welcome_free_rate?: number | null;
  welcome_premium_rate?: number | null;
  free_rate?: number | null;
  premium_rate?: number | null;
  strike_count?: number | null;
  last_strike_at?: string | null;
  promo_paused_until?: string | null;
  plan_forfeited_at?: string | null;
  /** Ghost-partner hold (MESITA-1311) — a held place is not promoting. */
  reward_lane_pending_review_at?: string | null;
};

/**
 * A guest gets a discount here right now.
 *
 * `pending` (paid, strategy set, first check not yet honored) counts as
 * promoting: the place has promised a discount and the guest's first ticket is
 * exactly how it activates — the same call assessPromoLane makes.
 */
export function isPlacePromoting(
  row: PromotingFields | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!row) return false;
  if (!isPaidPlan(row.plan ?? null)) return false;

  const strategy = placeStrategy(row as Record<string, unknown>);
  if (strategy === "zero") return false;

  const lane = assessPromoLane(
    {
      id: "",
      plan: row.plan ?? null,
      first_ticket_honored_at: null,
      plan_live_at: null,
      strike_count: typeof row.strike_count === "number" ? row.strike_count : 0,
      last_strike_at: row.last_strike_at ?? null,
      promo_paused_until: row.promo_paused_until ?? null,
      plan_forfeited_at: row.plan_forfeited_at ?? null,
      reward_lane_pending_review_at: row.reward_lane_pending_review_at ?? null,
    },
    now,
  );
  return lane.open;
}

/**
 * The place columns a guest must never receive. They are selected because the
 * server needs them (rate resolution, lane checks) and dropped here, at the
 * wire, once `promoting` has already been computed from them.
 *
 * A guest has no use for a restaurant's plan, and no business knowing its
 * strike record.
 */
export const BUSINESS_PRIVATE_PLACE_KEYS = [
  "plan",
  "strike_count",
  "last_strike_at",
  "promo_paused_until",
  "plan_forfeited_at",
  "plan_live_at",
  "first_ticket_honored_at",
  "reward_lane_pending_review_at",
] as const;

/**
 * HOW HARD a place is promoting right now, 0-3 (Pato, 2026-08-22):
 * 0 zero · 1 conservative · 2 aggressive · 3 dominant.
 *
 * A refinement of `isPlacePromoting`, never a replacement — it answers the same
 * question with the strategy ladder attached, and it agrees with the boolean by
 * construction: level 0 exactly when the boolean is false.
 *
 * That equivalence is the point. A paid place on Aggressive whose promo lane is
 * CLOSED (a strike pause) is NOT promoting, so it reads 0 even though its rate
 * columns say Aggressive — the level describes what a guest gets right now, not
 * what the place signed up for. Reading the strategy alone would show a live
 * discount on a place that will honor nothing, which is the exact bug
 * `promoting` was introduced to kill (MESITA-1150).
 */
export function placePromotingLevel(
  row: PromotingFields | null | undefined,
  now: Date = new Date(),
): 0 | 1 | 2 | 3 {
  if (!isPlacePromoting(row, now)) return 0;
  switch (placeStrategy(row as unknown as Record<string, unknown>)) {
    case "conservative":
      return 1;
    case "aggressive":
      return 2;
    case "dominant":
      return 3;
    default:
      // Unreachable: isPlacePromoting already rejected `zero`.
      return 0;
  }
}
