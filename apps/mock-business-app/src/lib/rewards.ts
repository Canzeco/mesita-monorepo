// THE REWARD PROGRAM, AND THE FACT THAT IT STILL ADDS UP.
//
// The bill engine has resolved a ticket ADDITIVELY since v12 (MESITA-1705,
// supabase `_shared/rewards-config.ts`):
//
//   rate = base + every earned bonus
//
// clamped at 100%, then bounded in pesos by the place's cap.
//
// ── THE TIERS ARE GONE (MESITA-2017) ───────────────────────────────────────
//
// Until this issue the operator picked a COLUMN — Off, Conservative,
// Aggressive — and nine priced rungs followed it. Pato, 2026-09-20: *"no hay
// que poner tiers, o sea, no hay que poner de que agresivo o eso, porque es
// como muy difícil de configurar… que un restaurante se ponga a pensar qué
// pedo."* So the rates are MESITA'S, one table, and what a place decides is
// six things:
//
//   1. whether the program is on
//   2. discount at the bill, or cashback for a later visit
//   3. the cap, in pesos
//   4. Welcome: first-ever visit, on or off
//   5. Instagram story, on or off
//   6. Mesita review, on or off
//
// THE SURVIVING COLUMN IS THE AGGRESSIVE ONE. It was the shipped default
// (`RewardsView` seeded a running place on it), and a table that is not a
// choice any more should be the one places were actually running.
//
// THE STORY BONUS IS FLAT. It used to add a class step — 2,000+ followers,
// 20,000+ — and Meta exposes no follower count for a personal account, so
// there is no data path to price it by (gate PC1, 2026-09-20). The class
// ladder stays in the ENGINE (`CLASS_STEP`, engine-only, nothing in this
// console reads it) for the day a path exists; it prices nothing today.
//
// THE GOOGLE REVIEW IS NOT A REWARDED ACTION. Google's contribution policy
// forbids a discount or a gift for a review, and the penalty lands on the
// restaurant's Business Profile, not on Mesita. The Mesita review stays: it is
// Mesita's own verifiable act, and it was in Pato's list of actions before a
// later "five parameters" compression dropped it without a decision.

/** Discount takes the slice off THIS bill; cashback banks it as Prepaid
 *  Credits for a later one — which is why cashback needs Credits on. */
export type RewardsMode = "discount" | "cashback";
export const MODE_LABEL: Record<RewardsMode, string> = {
  discount: "Discount at the bill",
  cashback: "Cashback for next time",
};

/** The three things a guest can DO to earn more than the base. Each is a
 *  switch the place owns; none is a number the place edits. */
export type ActionKey = "welcome" | "story" | "mesita";
export const ACTION_KEYS: readonly ActionKey[] = ["welcome", "story", "mesita"];
export const ACTION_LABEL: Record<ActionKey, string> = {
  welcome: "Welcome",
  story: "Instagram story",
  mesita: "Mesita review",
};
export const ACTION_HINT: Record<ActionKey, string> = {
  welcome: "Their first ever visit here. Once per guest, forever",
  story: "Tagged, at the table, public. One flat bonus — Mesita cannot read follower counts",
  mesita: "Once per place, on Mesita. The one review Mesita can verify itself",
};

/** MESITA'S TABLE. The standing rate every guest gets on every visit, and
 *  what each earned action adds to it. Whole percentage points. */
export const RATE: Record<"base" | ActionKey, number> = {
  base: 20,
  welcome: 10,
  story: 10,
  mesita: 5,
};

/** ENGINE-ONLY. What class used to add to the base, kept so the shape of the
 *  engine's config is still legible from here. No screen in this console
 *  reads it, no test asserts a per-class rate, and the story bonus above is
 *  flat on purpose. */
export type ClassKey = "bronze" | "silver" | "gold" | "diamond";
export const CLASS_STEP: Record<ClassKey, number> = {
  bronze: 0,
  silver: 10,
  gold: 20,
  diamond: 30,
};

// ── The cap ────────────────────────────────────────────────────────────────
//
// A percentage is not a peso. Every rate applies to the FIRST cap-pesos of the
// bill, which is what keeps a 45% ceiling from being a 45% night: at MX$500 the
// most generous guest there is costs MX$225, whatever they ordered. The three
// legal caps are the product's (`DISCOUNT_CAPS_MXN`, web-business
// `lib/business/strategies.ts`); a wider set is a product decision the mock
// does not get to invent.

export const CAPS_MXN = [200, 500, 1000] as const;
export type CapMxn = (typeof CAPS_MXN)[number];
export const DEFAULT_CAP: CapMxn = 500;

/** The most a percentage can cost at this cap, in CENTAVOS — money is an
 *  integer until the moment it is printed. `cap * pct` is `cap * 100 * pct/100`
 *  with the round-trip removed. */
export function capCostCents(pct: number, cap: CapMxn): number {
  return cap * pct;
}

// ── The program ────────────────────────────────────────────────────────────

/** What a place SET. `on` is the absence of the program, not a rung of it. */
export type RewardsProgram = {
  on: boolean;
  mode: RewardsMode;
  cap: CapMxn;
  welcome: boolean;
  story: boolean;
  mesita: boolean;
};

export const DEFAULT_PROGRAM: RewardsProgram = {
  on: true,
  mode: "discount",
  cap: DEFAULT_CAP,
  welcome: true,
  story: true,
  mesita: true,
};

/** What one guest EARNED on one visit. */
export type Earned = Record<ActionKey, boolean>;
export const NOTHING_EARNED: Earned = { welcome: false, story: false, mesita: false };
export const EVERYTHING_EARNED: Earned = { welcome: true, story: true, mesita: true };

/** The rate this visit pays, clamped exactly as the engine clamps. An action
 *  the place switched off pays nothing however loudly the guest earned it. */
export function rate(program: RewardsProgram, earned: Earned): number {
  if (!program.on) return 0;
  let t: number = RATE.base;
  for (const key of ACTION_KEYS) {
    if (program[key] && earned[key]) t += RATE[key];
  }
  return Math.min(100, t);
}

/** The climb, in the order the engine adds: base, then each action the place
 *  has on. Every step is a RUNNING total, so reading left to right is the
 *  same act as adding. Actions switched off are absent, not zero. */
export function stack(program: RewardsProgram): { key: "base" | ActionKey; label: string; total: number }[] {
  if (!program.on) return [];
  const out: { key: "base" | ActionKey; label: string; total: number }[] = [
    { key: "base", label: "Base", total: RATE.base },
  ];
  let t: number = RATE.base;
  for (const key of ACTION_KEYS) {
    if (!program[key]) continue;
    t = Math.min(100, t + RATE[key]);
    out.push({ key, label: `+ ${ACTION_LABEL[key]}`, total: t });
  }
  return out;
}

/** The most any guest can reach: every action the place has on, earned. */
export function ceiling(program: RewardsProgram): number {
  return rate(program, EVERYTHING_EARNED);
}
