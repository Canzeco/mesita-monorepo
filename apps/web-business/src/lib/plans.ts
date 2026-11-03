import type { BoostTier } from "@/lib/business-api";

// A place's plans (Pato, 2026-11-03, MESITA-3174; one subscription since
// MESITA-3173): Free · Pro · Max, each a Premier level — Free is Premier 1X,
// Pro (boost_2x) Premier 2X, Max (boost_5x) Premier 5X. "Plans", never
// "membership". "Premier 2X/5X" stays the level guests see.
export const FREE_PLAN = "Free";
export const PLAN_NAME: Record<BoostTier, string> = {
  boost_2x: "Pro",
  boost_5x: "Max",
};
/** The visibility each plan gives, Free included: the plan's one perk. */
export const FREE_VISIBILITY = "1X";
export const PLAN_VISIBILITY: Record<BoostTier, string> = {
  boost_2x: "2X",
  boost_5x: "5X",
};
const BY_RANK: Record<number, string> = { 1: PLAN_NAME.boost_2x, 2: PLAN_NAME.boost_5x };

/** The plan a subscription rank (1 = 2X, 2 = 5X) is; 0 or none is Free. */
export function planName(rank: number | null | undefined): string {
  return (rank && BY_RANK[rank]) || FREE_PLAN;
}
