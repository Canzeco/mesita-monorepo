// Recommendation Scores — the model behind Swipe · Map · Memo (draft).
//
// ONE MATCH, TWO ESTIMATORS. Match is always the same question — how well
// does this intent fit this place — asked at two fidelities:
//
//   RIPM  RAG intent-place match  cosine(intent embedding, place embedding).
//                                 Cheap; runs over the whole catalog in
//                                 pgvector.
//   LIPM  LLM intent-place match  a judge reads intent + place profile and
//                                 scores it. Expensive; shortlist only.
//
// FOUR LANES × TWO TIERS. The Slow column is the Fast column with LIPM
// swapped in for RIPM — nothing else moves. That symmetry is deliberate: fast
// and slow only disagree where the estimators disagree, which is exactly the
// disagreement the Swipe rerank exists to fix.
//
//   lane              Fast (RAG)      Slow (LLM)
//   organic   now     RIPM·WW         LIPM·WW
//   organic   future  RIPM            LIPM
//   inorganic now     RIPM·WW·P       LIPM·WW·P
//   inorganic future  RIPM·P          LIPM·P
//
//   RIPM, LIPM 0–100  0 is reachable and zeroes every lane — "money can't
//                     buy irrelevance" is the whole reason match multiplies.
//   WW         0–1    the moment: where(km) × when(opens_in, open_for).
//                     Now-mode only.
//   P          0–3    promos — the membership ladder; see ./strategies.
//
// ── TEXT vs NUMBERS — who actually knows about where/when ─────────────
// Intent-data and place-data both carry where/when as TEXT — an address, hours
// as written, a question that says "near Providencia tonight". So RIPM/LIPM
// may pick up place- and time-flavor implicitly. That's redundant with WW,
// and it's fine. What the match tiers NEVER receive is computed numbers: no
// distance-km, no hours-until-open are precomputed and written into their
// context. WW is the only function that computes where and when as numerical
// values — and it MULTIPLIES RIPM or LIPM; it never feeds them.
//
// ENGINES ARE PIPELINE POLICIES, not formulas — each decides how far up the
// fidelity ladder to climb (ENGINE_POLICIES below):
//
//   Swipe  screen with Fast (top n over the catalog — WW·P included, so no
//          Slow calls are wasted on closed or far places) → sort n with Slow.
//   Map    Fast only. RAG order is good enough at map altitude, and the
//          viewport already did half the filtering.
//   Memo   Slow sorts. Fast is recall only — its order is irrelevant.
//
// The only per-engine difference in inputs is where INTENT-data comes from:
// Swipe and Map read the prebuilt taste embedding (Map adds the viewport);
// Memo synthesizes intent from the question at query time. Place-data is
// always prebuilt by the Enricher. One place representation, one match
// definition, three query policies.
//
// The lanes never compete: organic results rank by the organic lane, promoted
// slots by the inorganic lane, and each sorts only against itself, so their
// different ceilings (100 vs 300) are meaningless across. Note the inorganic
// lane IS the organic lane × promos — the paid lane is the earned one tilted
// by generosity.
//
// ── WHERE ──────────────────────────────────────────────────────────────
//   where = 1 / (1 + (km / d₀)^s)
//
// A Hill curve, not an exponential. Human travel distances are heavy-tailed
// (s ≈ 1.6 is the empirical mobility exponent); an exponential puts 40km at
// ~0.0001 and effectively denies destination trips exist, which is most wrong
// for nightclubs — the destination category. `d₀` is the half-pull radius: the
// distance at which a place keeps half its appeal.
//
// ── WHEN = WAIT × FIT ──────────────────────────────────────────────────
// Two different questions, so two different shapes. Collapsing them into one
// curve is what forced the earlier drafts to be wrong in one direction or the
// other, whatever constant they used.
//
//   wait(a)   = 1 / (1 + (a / a½)^k)     cost of arriving `a` hours from now
//   fit(len)  = min(1, len / L)          is there time to complete the visit
//
// WAIT is a delay cost, and it plateaus. Five minutes of waiting is free; the
// cliff is where the plan dies. (An exponential has this backwards — it decays
// fastest at t=0, charging most for the first minute and least for the one that
// breaks the plan.) Same shape as `where`, on hours instead of km.
//
// FIT is NOT a decay — it's sufficiency. Closing early costs nothing until you
// can't finish, and past `L` more hours add nothing: a place open till 4am is
// no better than one open till midnight, for dinner. `L` is how long the visit
// needs, and it's category-shaped — coffee 0.5 · drink 1 · dinner 1.5 · night
// out 2.5.
//
// ── TIME RESOLUTION ────────────────────────────────────────────────────
// Time quantizes to 30-minute blocks before anything is computed. Real hours
// arrive on arbitrary minutes and the model has no business pretending to
// minute precision. 30 rather than 60 because the weight is front-loaded — an
// hour grid cannot tell "closes in 15 min" from "closes in 60 min", and that is
// exactly the distinction that matters most.
//
// EVERY KNOB IS A BELIEF, NOT AN ESTIMATE. There are no clicks, no conversions,
// no relevance labels — nothing here is fitted. Judge a change by its
// BREAK-EVEN (how far a mega-place's match must fall before a well-matched
// small place beats it), never by how far apart the numbers land: any monotone
// rescale leaves the ranking identical. Tune here; both the Scoring Config page
// and the per-place Scores tab derive from this config and never restate a knob
// (that is how database.types.ts drifted).

export const MATCH_MAX = 100;

/** Time resolves to half-hour blocks. */
export const TIME_BLOCK_H = 0.5;

export type ScoresConfig = {
  /** Distance at which a place keeps half its pull, km. */
  distanceHalfKm: number;
  /** Distance falloff exponent. 1.6 ≈ the empirical human-mobility exponent. */
  distanceExp: number;
  /** Waiting this many hours halves the place. */
  waitHalfH: number;
  /** Wait falloff exponent. 1 = no plateau; higher = free, then a wall. */
  waitExp: number;
  /** Hours the visit needs. Category-shaped. */
  sessionH: number;
};

export const DEFAULT_SCORES_CONFIG: ScoresConfig = {
  distanceHalfKm: 3,
  distanceExp: 1.6,
  waitHalfH: 1,
  waitExp: 2.5,
  sessionH: 1.5,
};

/** Snap hours to the 30-minute grid. Everything time-shaped goes through this. */
export function quantizeH(hours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.round(hours / TIME_BLOCK_H) * TIME_BLOCK_H;
}

/** Hill curve → 0–1. Plateau, shoulder, heavy tail. */
function hill(x: number, half: number, exp: number): number {
  if (!Number.isFinite(x) || x <= 0) return 1;
  if (half <= 0) return 0;
  return 1 / (1 + Math.pow(x / half, exp));
}

/** where — distance decay, 0–1. Unknown distance → 1 (don't punish missing geo). */
export function whereScore(km: number | null, cfg: ScoresConfig = DEFAULT_SCORES_CONFIG): number {
  if (km == null) return 1;
  return hill(km, cfg.distanceHalfKm, cfg.distanceExp);
}

/** wait — the cost of arriving `opensInH` hours from now, 0–1. Open now → 1. */
export function waitScore(opensInH: number, cfg: ScoresConfig = DEFAULT_SCORES_CONFIG): number {
  return hill(quantizeH(opensInH), cfg.waitHalfH, cfg.waitExp);
}

/** fit — is there time to complete the visit, 0–1. Caps at 1: enough is enough. */
export function fitScore(openForH: number, cfg: ScoresConfig = DEFAULT_SCORES_CONFIG): number {
  if (cfg.sessionH <= 0) return 1;
  return Math.max(0, Math.min(1, quantizeH(openForH) / cfg.sessionH));
}

/** when — the moment, 0–1. */
export function whenScore(
  opensInH: number,
  openForH: number,
  cfg: ScoresConfig = DEFAULT_SCORES_CONFIG,
): number {
  return waitScore(opensInH, cfg) * fitScore(openForH, cfg);
}

export type LaneId = "organic-now" | "organic-future" | "inorganic-now" | "inorganic-future";

export type Lane = {
  id: LaneId;
  /** "Organic" | "Inorganic" — which ranking this feeds. */
  lane: "organic" | "inorganic";
  /** "now" | "future" — a property of the QUERY, not the place. */
  mode: "now" | "future";
  formula: string;
  /** The lane's ceiling, for the `/N` an operator reads. */
  max: number;
};

export const PROMO_MAX = 3;

export const LANES: readonly Lane[] = [
  { id: "organic-now",     lane: "organic",   mode: "now",    formula: "match × where × when",          max: MATCH_MAX },
  { id: "organic-future",  lane: "organic",   mode: "future", formula: "match",                         max: MATCH_MAX },
  { id: "inorganic-now",   lane: "inorganic", mode: "now",    formula: "match × where × when × promos", max: MATCH_MAX * PROMO_MAX },
  { id: "inorganic-future",lane: "inorganic", mode: "future", formula: "match × promos",                max: MATCH_MAX * PROMO_MAX },
];

/** A lane's formula at one tier, in the model's shorthand — e.g. "LIPM·WW·P". */
export function laneFormula(lane: Lane, term: "RIPM" | "LIPM"): string {
  const parts: string[] = [term];
  if (lane.mode === "now") parts.push("WW");
  if (lane.lane === "inorganic") parts.push("P");
  return parts.join("·");
}

export type MatchTier = {
  id: "fast" | "slow";
  label: string;
  term: "RIPM" | "LIPM";
  detail: string;
};

/** One match (intent × place), two estimators. Fast screens; Slow settles. */
export const MATCH_TIERS: readonly MatchTier[] = [
  { id: "fast", label: "Fast", term: "RIPM", detail: "RAG intent-place match · cosine, whole catalog" },
  { id: "slow", label: "Slow", term: "LIPM", detail: "LLM intent-place match · judge, shortlist only" },
];

export type EnginePolicy = {
  engine: "Swipe" | "Map" | "Memo";
  policy: string;
  intent: string;
};

/** Engines don't own formulas — they decide how far up the fidelity ladder to climb. */
export const ENGINE_POLICIES: readonly EnginePolicy[] = [
  {
    engine: "Swipe",
    policy: "screen with Fast → sort the top n with Slow",
    intent: "prebuilt taste embedding",
  },
  {
    engine: "Map",
    policy: "Fast only — RAG order suffices at map altitude",
    intent: "taste embedding + viewport",
  },
  {
    engine: "Memo",
    policy: "Slow sorts — Fast is recall only, its order irrelevant",
    intent: "synthesized from the question, per query",
  },
];

export type LaneInputs = {
  /** 0–100 — RIPM or LIPM, whichever tier the caller is scoring. */
  match: number;
  /** 0–1. */
  where: number;
  /** 0–1. */
  when: number;
  /** 0–3. */
  promos: number;
};

/** One lane's rank value. Match multiplies un-floored, so 0 relevance zeroes it. */
export function laneScore(lane: Lane, i: LaneInputs): number {
  const m = Math.max(0, Math.min(MATCH_MAX, i.match));
  const moment = lane.mode === "now" ? i.where * i.when : 1;
  const paid = lane.lane === "inorganic" ? i.promos : 1;
  return m * moment * paid;
}
