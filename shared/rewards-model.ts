// THE REWARD MODEL. Four levers Mesita sets, and the one place they are set.
//
// This module is the ONLY definition of the lever percentages, the rewardable
// base and the per-plan ceiling. Every app and every Edge Function reads it —
// web-consumer, mobile-consumer, mock-business-app, web-business, web-admin and
// supabase/functions/_shared — so a rate change is a one-file edit rather than a
// sweep. Before this existed the same numbers lived in SEVEN hand-maintained
// copies and two of them had already drifted in user-visible copy, with no
// generator and no CI gate comparing them (MESITA-2038).
//
//   Base     10%  every visit paid through Mesita
//   Welcome  10%  the guest's first validated visit to that place
//   Story    20%  a verified Instagram story tagging the place
//   Diamond  20%  the guest is on the Diamond list — invitation only, by Mesita
//
// ── THE CAP IS ON THE BASE, NOT ON THE REWARD ──────────────────────────────
//
// The percentages apply to the FIRST MX$200 of the bill and nothing beyond it.
// That one sentence decides everything downstream, and it is the opposite of
// what "max MX$120" reads like at a glance:
//
//   bill MX$1,200, base only      10% of 20_000 = MX$20      (not MX$120)
//   bill MX$1,200, everything     60% of 20_000 = MX$120
//   bill MX$100,   base only      10% of 10_000 = MX$10
//
// So a lever's peso value is CONSTANT above the base and SMALLER below it. A
// story is worth exactly MX$40 at any bill over MX$200, and MX$20 at a MX$100
// bill. It is never worth nothing because the bill is large — the only way a
// lever contributes zero is that the stack already sits at the plan's ceiling,
// or the eligible base is zero. `isLeverInert` is the one function allowed to
// answer that question; a caller that reasons "bill > 200, therefore inert"
// has it exactly backwards and will hide a real MX$40 offer at the common case.
//
// ── THE CEILING IS PER PLAN, AND IT IS HAND-WRITTEN ────────────────────────
//
// Pro runs three levers (40%, MX$80), Ultra runs four (60%, MX$120). Story is
// Ultra's alone: it is the only lever that cannot be resolved at quote time, so
// it is the only one that can need a late top-up, and the top-up vehicle is
// Prepaid Credits, which Pro does not have.
//
// PLAN_MAX_PCT IS NOT DERIVED FROM THE LEVER SUM, and that is the whole point.
// 10+10+20+20 is exactly 60; deriving the ceiling from the levers would make
// the clamp unreachable dead code and turn "max 60%" from a constraint into a
// restatement. The assertion below is the guard — it fails loudly if a lever
// moves past its plan's ceiling, which a derivation would silently absorb.

/** What a place pays Mesita. `free` runs no Member Visits at all. */
export type PlanTier = "free" | "pro" | "ultra";

/** The four levers. Base is the program's master switch, not a peer toggle:
 *  Base off IS the program off. Diamond is Mesita's own list and a place does
 *  not get to decline it — the console discloses it, never switches it. */
export type LeverKey = "base" | "welcome" | "story" | "diamond";

export const LEVER_KEYS: readonly LeverKey[] = [
  "base",
  "welcome",
  "story",
  "diamond",
];

/** Whole percentage points. Mesita's table, not a place's. */
export const LEVER_PCT: Record<LeverKey, number> = {
  base: 10,
  welcome: 10,
  story: 20,
  diamond: 20,
};

export const LEVER_LABEL: Record<LeverKey, string> = {
  base: "Base",
  welcome: "Welcome",
  story: "Instagram story",
  diamond: "Diamond",
};

/** Which levers a plan may run AT ALL, before the place switches anything on.
 *  A lever absent here is not "off" — it is not available, and the console
 *  must render it locked with a door, never hidden and never as a plain
 *  switch the operator can flip. */
export const PLAN_LEVERS: Record<PlanTier, readonly LeverKey[]> = {
  free: [],
  pro: ["base", "welcome", "diamond"],
  ultra: ["base", "welcome", "story", "diamond"],
};

/** The ceiling per plan, in whole percentage points. Hand-written on purpose —
 *  see the header. */
export const PLAN_MAX_PCT: Record<PlanTier, number> = {
  free: 0,
  pro: 40,
  ultra: 60,
};

// ── Money ──────────────────────────────────────────────────────────────────
//
// CENTAVOS IS THE UNIT. Every number below is centavos and no caller multiplies
// by 100; a peso figure is produced only at the moment it is printed, by
// `formatPesosExact` in `shared/format.ts`. The earlier draft of this module
// published `REWARD_BASE_MXN = 200` while its one real call site hardcoded
// `20000 centavos`, which is a units bug with a literal inside the module whose
// entire job is preventing drift.

/** The rewardable base: percentages apply to the first MX$200 of the bill and
 *  to nothing beyond it. */
export const REWARD_BASE_CENTAVOS = 20_000;

/** The most a visit can pay at this plan, in centavos. MX$80 at Pro, MX$120 at
 *  Ultra. Derived from the base and the plan ceiling — that derivation is safe
 *  because both inputs are hand-written and asserted below. */
export function planMaxCentavos(plan: PlanTier): number {
  return Math.floor((REWARD_BASE_CENTAVOS * PLAN_MAX_PCT[plan]) / 100);
}

// ── The follower gate, deliberately dormant ────────────────────────────────
//
// Pato's Story lever names three conditions: a tagged mention, a public
// account, and 1,000+ followers. Under place-side verification the first two
// are answered by the webhook itself — a `story_mention` only fires when the
// mentioning account is public (or follows the place), so ARRIVAL is the
// public-account proof. The follower count needs the User Profile API keyed by
// the sender's Instagram-scoped ID, and Meta's docs never state that a story
// mention establishes the messaging consent that call requires. Until a spike
// settles it, the threshold is stored and NOT enforced.
//
// The flag is named rather than commented out so that a reader cannot mistake
// the constant for a live rule, and so the day it flips is one line.

export const STORY_MIN_FOLLOWERS = 1_000;

/** DORMANT. Flip only when the User Profile API consent path is proven; until
 *  then a verified mention from a public account pays Story in full. */
export const STORY_FOLLOWER_GATE_ENFORCED = false;

// ── What a place set, and what a guest earned ──────────────────────────────

/** A lever's state on one place's program, or on one guest's visit. */
export type LeverState = Readonly<Partial<Record<LeverKey, boolean>>>;

/** Nothing switched on, nothing earned. */
export const NO_LEVERS: LeverState = Object.freeze({});

/**
 * The levers that actually pay on this visit: available at the plan, switched
 * on by the place, and earned by the guest. Base is the master switch — with
 * it off the program is off and nothing pays, however loudly the guest earned
 * the rest.
 *
 * Order follows LEVER_KEYS so a breakdown reads the same everywhere.
 */
export function activeLevers(
  plan: PlanTier,
  program: LeverState,
  earned: LeverState,
): LeverKey[] {
  if (program.base !== true) return [];
  const available = PLAN_LEVERS[plan];
  return LEVER_KEYS.filter(
    (key) =>
      available.includes(key) &&
      program[key] === true &&
      (key === "base" || earned[key] === true),
  );
}

/** The rate this visit pays, in whole percentage points, clamped at the plan's
 *  ceiling. The clamp is a real guard, not a formality — see the header. */
export function ratePct(
  plan: PlanTier,
  program: LeverState,
  earned: LeverState,
): number {
  const total = activeLevers(plan, program, earned).reduce(
    (sum, key) => sum + LEVER_PCT[key],
    0,
  );
  return Math.min(total, PLAN_MAX_PCT[plan]);
}

/**
 * The slice of the bill a percentage may be taken from.
 *
 * THE TIP IS NOT SUBTRACTED HERE, and that is deliberate. The ticket's
 * `bill_subtotal_cents` is already tip-exclusive — `_shared/business-ticket-billing.ts`
 * computes the tip on the raw subtotal and ADDS it (`totalCents = subtotal +
 * tipCents`), and the discount base is the subtotal with the tip excluded.
 * Subtracting a tip from that number again would under-pay every reward below
 * the base, silently, and invisibly above it (where the clamp hides the
 * difference). A caller holding a tip-INCLUSIVE total must subtract the tip
 * before calling this, not after.
 */
export function eligibleBaseCentavos(subtotalCentavos: number): number {
  if (!Number.isFinite(subtotalCentavos) || subtotalCentavos <= 0) return 0;
  return Math.min(Math.floor(subtotalCentavos), REWARD_BASE_CENTAVOS);
}

/** What this visit pays, in centavos. Floors — money is an integer until it is
 *  printed, and a guest is never paid a fraction of a centavo. */
export function rewardCentavos(
  plan: PlanTier,
  program: LeverState,
  earned: LeverState,
  subtotalCentavos: number,
): number {
  const base = eligibleBaseCentavos(subtotalCentavos);
  if (base === 0) return 0;
  return Math.floor((base * ratePct(plan, program, earned)) / 100);
}

/**
 * What ONE more lever would add to this visit, in centavos.
 *
 * This is the only correct way to ask "is it worth offering?". A lever adds
 * zero when the stack is already at the plan's ceiling or the eligible base is
 * zero — never because the bill is large. At a MX$1,200 bill a story adds
 * exactly MX$40; at a MX$100 bill it adds MX$20.
 */
export function marginalCentavos(
  plan: PlanTier,
  program: LeverState,
  earned: LeverState,
  subtotalCentavos: number,
  lever: LeverKey,
): number {
  const now = rewardCentavos(plan, program, earned, subtotalCentavos);
  const withIt = rewardCentavos(
    plan,
    program,
    { ...earned, [lever]: true },
    subtotalCentavos,
  );
  return Math.max(0, withIt - now);
}

/** Whether a lever should render as satisfied-or-inert rather than as an offer.
 *  An offer that pays nothing is the one thing in this model that would cost
 *  the guest's trust, so the test is the peso, never the bill. */
export function isLeverInert(
  plan: PlanTier,
  program: LeverState,
  earned: LeverState,
  subtotalCentavos: number,
  lever: LeverKey,
): boolean {
  if (earned[lever] === true) return true;
  return marginalCentavos(plan, program, earned, subtotalCentavos, lever) === 0;
}

/**
 * The effective rate this visit pays against the WHOLE bill, in percent.
 *
 * Not the lever sum. Once the bill passes MX$200 the two diverge fast: a
 * base-only guest at MX$1,200 is on 10% of the model and 1.67% of their bill.
 * Any surface that prints a percentage beside a peso figure must print this
 * one, or the guest reads a number they are not being paid.
 */
export function effectiveRatePct(
  plan: PlanTier,
  program: LeverState,
  earned: LeverState,
  subtotalCentavos: number,
): number {
  if (!Number.isFinite(subtotalCentavos) || subtotalCentavos <= 0) return 0;
  return (
    (rewardCentavos(plan, program, earned, subtotalCentavos) /
      subtotalCentavos) *
    100
  );
}

/** The climb, as running totals, in the order the engine adds. Reading it left
 *  to right is the same act as adding. Levers the plan or the place does not
 *  run are absent, not zero. */
export function leverStack(
  plan: PlanTier,
  program: LeverState,
): { key: LeverKey; label: string; pct: number; total: number }[] {
  if (program.base !== true) return [];
  const available = PLAN_LEVERS[plan];
  const out: { key: LeverKey; label: string; pct: number; total: number }[] = [];
  let total = 0;
  for (const key of LEVER_KEYS) {
    if (!available.includes(key) || program[key] !== true) continue;
    total = Math.min(total + LEVER_PCT[key], PLAN_MAX_PCT[plan]);
    out.push({ key, label: LEVER_LABEL[key], pct: LEVER_PCT[key], total });
  }
  return out;
}

/** The most any guest can reach at this place: every lever it runs, earned. */
export function ceilingPct(plan: PlanTier, program: LeverState): number {
  const everything = Object.fromEntries(
    LEVER_KEYS.map((k) => [k, true]),
  ) as LeverState;
  return ratePct(plan, program, everything);
}

// ── The guard ──────────────────────────────────────────────────────────────
//
// A ceiling that no lever set can reach is not a ceiling. This fails at import
// time rather than at a till: raise a lever past its plan's max, or add a fifth
// lever, and the module refuses to load until the ceiling is reconsidered.

for (const plan of ["pro", "ultra"] as const) {
  const sum = PLAN_LEVERS[plan].reduce((n, key) => n + LEVER_PCT[key], 0);
  if (sum > PLAN_MAX_PCT[plan]) {
    throw new Error(
      `rewards-model: ${plan} levers sum to ${sum}% but PLAN_MAX_PCT[${plan}] is ` +
        `${PLAN_MAX_PCT[plan]}% — raise the ceiling deliberately or lower a lever; ` +
        `do NOT derive the ceiling from the sum (that deletes this guard).`,
    );
  }
}

if (PLAN_LEVERS.free.length !== 0 || PLAN_MAX_PCT.free !== 0) {
  throw new Error("rewards-model: Free runs no Member Visits");
}
