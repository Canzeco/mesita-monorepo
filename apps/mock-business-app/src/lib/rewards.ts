// THE REWARD PROGRAM, AS THIS CONSOLE SHOWS IT.
//
// The math is NOT here any more. `@/lib/rewards-model` is a generated copy of
// `shared/rewards-model.ts`, which every app and every Edge Function reads, so
// the lever percentages, the rewardable base and the per-plan ceiling have one
// definition and this file has none of them (MESITA-2038). What survives here
// is presentation: the labels and hints a console prints, and the shape of the
// thing a place saves.
//
// ── WHAT THE OPERATOR ACTUALLY DECIDES ─────────────────────────────────────
//
// Three things, down from six:
//
//   1. whether the program is on
//   2. how it comes back — discount at the bill, or cashback for a later visit
//   3. which of the two earnable bonuses are running
//
// THE CAP IS GONE. It used to be a choice between MX$200 / 500 / 1000; the
// model now fixes the rewardable base at the first MX$200 for everyone, so
// there is nothing to pick. The peso ceiling follows from the plan instead.
//
// THE MESITA REVIEW LEVER IS GONE. Pato's table names four levers and is
// exhaustive; this one is not in it. Recorded as a decision rather than an
// oversight, because the file used to argue for keeping it.
//
// GOOGLE REVIEWS PAY NOTHING, and that has not changed: Google's contribution
// policy forbids a reward for a review and the penalty lands on the
// restaurant's Business Profile, not on Mesita.
//
// ── BASE AND DIAMOND ARE NOT TOGGLES ───────────────────────────────────────
//
// Base is the program's MASTER SWITCH — base off IS the program off, so it is
// the "Rewards" row, not a peer bonus beside Welcome and Story. Diamond is
// Mesita's own invitation list and applies whether the guest posts or not; a
// place does not get to decline Mesita's guests, so the console DISCLOSES it
// and never renders a switch the operator appears to own.
//
// That leaves exactly two rows an operator flips: Welcome and Story.

import {
  LEVER_PCT,
  PLAN_LEVERS,
  type LeverKey,
  type LeverState,
  type PlanTier,
} from "@/lib/rewards-model";

export type { LeverKey, LeverState, PlanTier };
export { LEVER_PCT, PLAN_LEVERS };

/** Discount takes the slice off THIS bill; cashback banks it as Prepaid
 *  Credits for a later one — which is why cashback needs Credits on. */
export type RewardsMode = "discount" | "cashback" | "both";
export const MODE_LABEL: Record<RewardsMode, string> = {
  discount: "Discount at the bill",
  cashback: "Cashback for next time",
  both: "Guest chooses",
};

/** What each mode needs behind it. Discount takes the slice off THIS bill and
 *  needs nothing — it works with cash and the place's own terminal. The other
 *  two settle later, so they need somewhere to put the money: Prepaid Credits,
 *  which is Ultra's, and Online Payments under it. */
export const MODE_NEEDS_CREDITS: Record<RewardsMode, boolean> = {
  discount: false,
  cashback: true,
  both: true,
};

export const MODE_HINT: Record<RewardsMode, string> = {
  discount:
    "The slice comes off the cheque in front of the guest. Cash or card, your terminal, nothing to settle afterwards.",
  cashback:
    "The guest pays in full and the slice lands as Prepaid Credits for their next visit here.",
  both: "The guest picks at the table. Discount is preselected — cashback is money they cannot spend today.",
};

/** The two levers a place switches. Base is the master switch and Diamond is
 *  Mesita's, so neither is here. */
export type BonusKey = Extract<LeverKey, "welcome" | "story">;
export const BONUS_KEYS: readonly BonusKey[] = ["welcome", "story"];

export const LEVER_LABEL: Record<LeverKey, string> = {
  base: "Rewards",
  welcome: "Welcome",
  story: "Instagram story",
  diamond: "Diamond",
};

export const LEVER_HINT: Record<LeverKey, string> = {
  base: "Every visit paid through Mesita earns the base.",
  welcome: "Their first ever visit here. Once per guest, forever",
  story:
    "Tagged, at the table, from a public account. Verified by Mesita, not by your staff",
  diamond:
    "Mesita's own list, invitation only. It applies on every visit, posting or not — you do not switch it, and you do not fund a guest Mesita did not send you",
};

/** What a place SET. `on` is the absence of the program, not a rung of it. */
export type RewardsProgram = {
  on: boolean;
  mode: RewardsMode;
  welcome: boolean;
  story: boolean;
};

export const DEFAULT_PROGRAM: RewardsProgram = {
  on: true,
  mode: "discount",
  welcome: true,
  story: true,
};

/**
 * The program as the shared model wants it: a lever map, with Base following
 * `on` and Diamond always true because it is Mesita's to run.
 *
 * A lever the PLAN does not carry is still `true` here — `activeLevers` is what
 * drops it. Keeping the two questions apart is what lets the console render a
 * locked Story row that shows what the place would get on Ultra, rather than a
 * row that silently reads as "off".
 */
export function toLeverState(program: RewardsProgram): LeverState {
  return {
    base: program.on,
    welcome: program.welcome,
    story: program.story,
    diamond: true,
  };
}

/** Whether this plan carries a lever at all. A lever it does not carry is
 *  LOCKED, which is a different thing from off and must never render as a
 *  plain switch the operator can flip. */
export function planCarries(plan: PlanTier, lever: LeverKey): boolean {
  return PLAN_LEVERS[plan].includes(lever);
}
