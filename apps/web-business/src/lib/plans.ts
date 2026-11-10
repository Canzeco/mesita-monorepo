import type { BoostTier } from "@/lib/business-api";

// A place's plans (Pato, 2026-11-03, MESITA-3174; one subscription since
// MESITA-3173): Free · Pro · Max, each a Premier level — Free is Premier 1X,
// Pro (boost_2x) Premier 2X, Max (boost_5x) Premier 5X. "Plans", never
// "membership". "Premier 2X/5X" stays the level guests see.
// Free and planName live in @mesita/place-profile (MESITA-3595) so the
// admin console names a plan the same way.
export { FREE_PLAN, planName } from "@mesita/place-profile/lib/place-states";
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
