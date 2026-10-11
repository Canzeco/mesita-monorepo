// DISCOVERY BLEND — how the seven earned signals compose (Docs › Discovery
// §A, MESITA-1196).
//
// ONE PASS. blend() is the product of `s^w` across the seven signals in
// discovery-signals.ts, and rankByBlend() sorts a pool by it. Nothing runs
// after the sort and nothing reorders on money: the order a guest is served
// is the order the signals earned, ties broken by incoming order.
//
// WEIGHTS ARE EXPONENTS, NOT MULTIPLIERS. Each signal enters as `s^w`. Since
// s ∈ [0,1]:
//
//   w = 0     the signal is OFF. s^0 = 1, the identity — it leaves the product
//             untouched. This is how an operator disables a signal, and it is
//             why the admin table needs no separate on/off column.
//   w < 1     SOFTER. r^0.3 pulls a uniform draw up toward 1, so the signal
//             only ever breaks near-ties.
//   w = 1     the signal's own number, unmodified.
//   w > 1     HARSHER. Squaring pushes everything short of near-perfect toward
//             zero. "Proximity is twice as important as Popularity" means
//             w=2 against w=1 — a ratio of exponents, not of shares.
//
// A multiplicative blend is not the only option and it is chosen on purpose: a
// weighted SUM lets one strong signal carry a place that fails everything else
// (a beloved restaurant 40 km away, closed), whereas a product requires a place
// to be at least acceptable on every signal an operator has switched on. For a
// deck a guest swipes one card at a time, "good on every axis" is the right
// bar. It also means a single zero deletes a place, which is why no signal in
// the library returns a hard 0 except Proximity past its maximum — see the
// deletion-vs-demotion note in discovery-signals.ts.
//
// THE PRODUCT IS NOT NORMALIZED and does not need to be. Seven signals near 0.8
// multiply to ~0.21, which looks alarming and means nothing: only the ORDER is
// consumed. Taking a geometric mean (the nth root) would rescale every score
// identically and change no comparison, at the cost of a pow() per place. The
// raw product is kept so `score` in a debug payload is the literal thing the
// code computed.

import {
  clamp01,
  NEUTRAL,
  SIGNAL_KEYS,
  SIGNALS,
  type SignalIntent,
  type SignalKey,
  type SignalParamBag,
  type SignalPlace,
} from "./discovery-signals.ts";

/** One exponent per signal. */
export type SignalWeights = Record<SignalKey, number>;

/** One param bag per signal. Missing keys fall back inside the signal. */
export type SignalParamsByKey = Partial<Record<SignalKey, SignalParamBag>>;

/**
 * What one place scored, and why.
 *
 * `parts` records what each signal CONTRIBUTED, which for a disabled signal is
 * NEUTRAL — not what it would have said if it were on. That distinction is
 * load-bearing in both directions: a disabled signal is never CALLED (so a
 * pool of a thousand places does not pay for seven signals when the operator
 * switched four off, and Randomness cannot spend a `Math.random()` whose value
 * is thrown away), and the debug payload therefore reports the blend that
 * actually ran rather than a hypothetical one. A part that reads 1 means "this
 * did not move the score", which is true whether the signal abstained or the
 * operator turned it off — and the weights table already says which.
 */
export type BlendResult = {
  score: number;
  parts: Record<SignalKey, number>;
};

/**
 * The earned score: `Π sᵢ^wᵢ`.
 *
 * A weight of 0 short-circuits before the signal is called. Not merely as an
 * optimisation: `Math.pow(0, 0)` is 1 in IEEE 754, so a disabled signal
 * returning a hard 0 would come out "correct" by accident, and relying on that
 * would make the disable path depend on a floating-point convention instead of
 * on control flow.
 */
export function blend(
  place: SignalPlace,
  intent: SignalIntent,
  weights: SignalWeights,
  params?: SignalParamsByKey,
): BlendResult {
  const parts = {} as Record<SignalKey, number>;
  let score = 1;

  for (const key of SIGNAL_KEYS) {
    const w = weights[key];
    if (!Number.isFinite(w) || w <= 0) {
      parts[key] = NEUTRAL; // OFF — never called, contributes the identity
      continue;
    }
    const s = clamp01(SIGNALS[key](place, intent, params?.[key]));
    parts[key] = s;
    score *= w === 1 ? s : Math.pow(s, w);
  }

  return { score: Number.isFinite(score) ? score : 0, parts };
}

// ── The ranking ──────────────────────────────────────────────────────────────

export type Ranked<T> = {
  row: T;
  score: number;
  parts: Record<SignalKey, number>;
};

/**
 * Score a pool and sort it, best first.
 *
 * Ties break on the pool's INCOMING order, not on anything else — the sort is
 * stable (ECMAScript guarantees it) and the index tiebreak makes that explicit
 * rather than incidental. Two places that genuinely tie must not silently
 * reorder between calls, or the Randomness signal would be doing its job twice.
 */
export function rankByBlend<T>(
  rows: T[],
  project: (row: T) => SignalPlace,
  intent: SignalIntent,
  weights: SignalWeights,
  params?: SignalParamsByKey,
): Ranked<T>[] {
  return rows
    .map((row, i) => {
      const { score, parts } = blend(project(row), intent, weights, params);
      return { row, score, parts, i };
    })
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map(({ row, score, parts }) => ({ row, score, parts }));
}
