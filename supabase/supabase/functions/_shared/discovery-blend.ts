// DISCOVERY BLEND — how the ten earned signals compose, and where the bought
// lane attaches (Docs › Discovery §A, MESITA-1196).
//
// TWO LANES, AND THEY NEVER MIX.
//
//   Lane 1 · EARNED    blend() — the product of `s^w` across the ten signals
//                      in discovery-signals.ts. It cannot read a rate or
//                      strategy. Partnership may read `plan`. Promotion may
//                      read the computed `promoting` boolean.
//   Lane 2 · BOUGHT    slotPromoted() — a pass over the ALREADY-RANKED list
//                      that moves promoting places forward into fixed slot
//                      positions. It cannot read a score, because it does not
//                      take one.
//
// That separation is the answer to the open question Docs §A left standing
// ("how they stay separable is not settled, and picking an exponent is not an
// answer"). Money still buys a POSITION via slotting, never an extra
// exponent. Promotion is a separate earned fact (live discount now), not
// the slotting pass. With slotting on or off, the relative order of every
// place that did not buy a slot stays identical.
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
// THE PRODUCT IS NOT NORMALIZED and does not need to be. Eight signals near 0.8
// multiply to ~0.17, which looks alarming and means nothing: only the ORDER is
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
import { placePromotingLevel, type PromotingFields } from "./place-promoting.ts";

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
 * pool of a thousand places does not pay for eight signals when the operator
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

// ── Lane 1 · the earned ranking ──────────────────────────────────────────────

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

// ── Lane 2 · the bought slots ────────────────────────────────────────────────

/**
 * How the bought lane is priced: every Nth position in the output is a slot a
 * promoting place may be MOVED FORWARD into. Not inserted — moved. A place
 * appears exactly once either way; buying a strategy changes where it sits,
 * never whether it exists and never what it scored.
 */
export type SlottingConfig = {
  enabled: boolean;
  /** 1-based: everyNth = 5 makes positions 5, 10, 15… bought slots. */
  everyNth: number;
};

/**
 * Which promoting place fills a slot: highest strategy tier first (dominant 3
 * › aggressive 2 › conservative 1), and inside a tier the one that already
 * ranked best on merit. So a Strategy buys PRIORITY IN THE QUEUE FOR SLOTS,
 * and among places that bought the same thing, the earned ranking still
 * decides. Money never reorders places against each other on merit; it only
 * decides who gets the next bought position.
 */
function promotedQueue<T>(
  ranked: Ranked<T>[],
  promoting: (row: T) => PromotingFields | null | undefined,
  now: Date,
): { index: number; tier: number }[] {
  return ranked
    .map((r, index) => ({ index, tier: placePromotingLevel(promoting(r.row), now) }))
    .filter((x) => x.tier > 0)
    .sort((a, b) => b.tier - a.tier || a.index - b.index);
}

/**
 * The bought lane. Takes the earned order in, returns the served order out.
 *
 * INVARIANT (asserted in discovery-blend.test.ts): removing every promoted row
 * from the output leaves the earned order untouched. This function may only
 * ever pull a row FORWARD out of the earned sequence; everything it does not
 * touch keeps its relative position. That is the machine-checkable form of
 * "rank is never for sale".
 */
export function slotPromoted<T>(
  ranked: Ranked<T>[],
  promoting: (row: T) => PromotingFields | null | undefined,
  cfg: SlottingConfig,
  now: Date = new Date(),
): Ranked<T>[] {
  if (!cfg.enabled) return ranked;
  const everyNth = Math.max(2, Math.floor(cfg.everyNth));
  if (!Number.isFinite(everyNth) || ranked.length === 0) return ranked;

  const queue = promotedQueue(ranked, promoting, now);
  if (queue.length === 0) return ranked;

  const taken = new Set<number>();
  const out: Ranked<T>[] = [];
  let queueAt = 0;
  let earnedAt = 0;

  const nextEarned = (): Ranked<T> | null => {
    while (earnedAt < ranked.length && taken.has(earnedAt)) earnedAt += 1;
    if (earnedAt >= ranked.length) return null;
    const pick = ranked[earnedAt];
    taken.add(earnedAt);
    return pick;
  };

  const nextPromoted = (): Ranked<T> | null => {
    while (queueAt < queue.length && taken.has(queue[queueAt].index)) queueAt += 1;
    if (queueAt >= queue.length) return null;
    const { index } = queue[queueAt];
    taken.add(index);
    return ranked[index];
  };

  for (let position = 1; position <= ranked.length; position += 1) {
    const isSlot = position % everyNth === 0;
    // A slot with nobody left to fill it falls back to merit rather than
    // holding a gap — an empty card is worse for everyone than an earned one.
    const pick = (isSlot ? nextPromoted() ?? nextEarned() : nextEarned());
    if (!pick) break;
    out.push(pick);
  }

  return out;
}

// ── The whole pipeline ───────────────────────────────────────────────────────

/**
 * Earned blend, then bought slots. The one entry point an engine calls, so no
 * surface can accidentally run the lanes in the other order — slotting before
 * scoring would let a bought position survive a re-sort, which is the failure
 * this whole shape exists to prevent.
 */
export function discoveryRank<T>(
  rows: T[],
  project: (row: T) => SignalPlace,
  promoting: (row: T) => PromotingFields | null | undefined,
  intent: SignalIntent,
  weights: SignalWeights,
  slotting: SlottingConfig,
  params?: SignalParamsByKey,
): Ranked<T>[] {
  const earned = rankByBlend(rows, project, intent, weights, params);
  return slotPromoted(earned, promoting, slotting, intent.now ?? new Date());
}

/** Re-exported so an engine imports one module, not three. */
export { NEUTRAL, SIGNAL_KEYS, type SignalIntent, type SignalKey, type SignalPlace };
