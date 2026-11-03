import type { BoostTier } from "@/lib/business-api";

// The Business plans (Pato, 2026-11-03, MESITA-3173): one subscription that
// buys all the software, in three tiers. Pro and Ultra are the boost_2x and
// boost_5x subscriptions and include Premier 2X and 5X ranking; "Premier 2X/5X"
// stays the name of the ranking level guests see. Guests already have Plan
// Free / Pro, so a Business plan always carries "Mesita Business".
export const FREE_PLAN = "Mesita Business Free";
export const PLAN_NAME: Record<BoostTier, string> = {
  boost_2x: "Mesita Business Pro",
  boost_5x: "Mesita Business Ultra",
};
const BY_RANK: Record<number, string> = { 1: PLAN_NAME.boost_2x, 2: PLAN_NAME.boost_5x };

/** The plan a subscription rank (1 = 2X, 2 = 5X) is; 0 or none is Free. */
export function planName(rank: number | null | undefined): string {
  return (rank && BY_RANK[rank]) || FREE_PLAN;
}
