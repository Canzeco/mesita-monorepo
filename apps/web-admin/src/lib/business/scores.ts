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

// WW defaults, argued from what Mesita IS — not from what looked right on a
// 5-row catalog:
//
//   distanceHalfKm 6 — GDL and MTY are CAR cities. A normal Friday span (San
//     Pedro → Centro ≈ 8 km) must survive scoring: at d₀=6 it keeps 0.39, a
//     20 km cross-town destination keeps 0.13 (visible, demoted), 40 km keeps
//     0.04 (inter-city, dead — correct). The old 3 km was a walkable-zone
//     number; the walkable case is what the Map viewport already handles.
//   waitHalfH 1.5 — nightlife arithmetic. Clubs open at 23:00; the consumer
//     browsing at 21:00 is the CORE user, not an edge case. At 1.5 h a 2 h
//     wait keeps 0.33 (alive, demoted); the old 1.0 h left it at 0.15 —
//     hiding every club during the prime browsing window.
//   waitExp 2.5 — the plateau-then-cliff shape: a 30 min wait is ≈ free
//     (0.94), the cliff lands where plans actually die. 1 has no plateau; 5
//     is a wall.
//   sessionH 1.5 — the archetypal Mesita session is DINNER: the discount
//     mechanic centres on a sit-down bill (first MX$500). Coffee/drink/night
//     -out become per-category L when categories drive it.
//   distanceExp 1.6 — the empirical human-mobility exponent; a fact more
//     than a knob.
export const DEFAULT_SCORES_CONFIG: ScoresConfig = {
  distanceHalfKm: 6,
  distanceExp: 1.6,
  waitHalfH: 1.5,
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

export type EngineId = "swipe" | "map" | "memo";

export type EnginePolicy = {
  id: EngineId;
  engine: "Swipe" | "Map" | "Memo";
  /** The tier pipeline — a fact of the architecture, not a hyperparameter. */
  policy: string;
  intent: string;
};

// Engines don't own formulas — every engine screens with Fast and sorts with
// Slow (Pato 2026-07-14, superseding the earlier per-engine split where Map
// was Fast-only and Memo Slow-only). What differs per engine is intent-data
// and its LANE MIX (DEFAULT_ENGINE_MIX below).
export const ENGINE_POLICIES: readonly EnginePolicy[] = [
  { id: "swipe", engine: "Swipe", policy: "fast screens → slow sorts", intent: "prebuilt taste embedding" },
  { id: "map",   engine: "Map",   policy: "fast screens → slow sorts", intent: "taste embedding + viewport" },
  { id: "memo",  engine: "Memo",  policy: "fast screens → slow sorts", intent: "synthesized from the question, per query" },
];

/**
 * Engine lane mix — what share of an engine's results each lane supplies.
 * THE interleave knob (previously "TBD"). Percentages per engine sum to 100.
 *
 * Each row is the product of TWO beliefs, both derived from Mesita's value
 * proposition rather than fitted (there is nothing to fit against):
 *
 * PAID SHARE — by trust-sensitivity of the surface. "Visibility follows
 * generosity" must materialise as real slots, but "money can't buy
 * irrelevance" caps how many:
 *   Swipe 30% — the deck is natural promoted inventory (feed convention),
 *     and a Mesita "ad" is consumer-positive: the promoted card carries the
 *     BIGGER discount.
 *   Map 20% — promoted pins are an accepted map convention, but spatial
 *     browsing is task-driven; lighter touch.
 *   Memo 10% — a concierge answering with paid results is the most
 *     trust-sensitive surface on the product. 10% keeps the membership
 *     promise honest without polluting answers.
 *
 * NOW SHARE — by the surface's temporal intent (the runtime mode still
 * follows the actual query; this is the prior):
 *   Swipe 80/20 — the deck is "tonight", with a save-for-later tail.
 *   Map 80/20 — mostly "what's around me", some trip planning.
 *   Memo 50/50 — questions split between "tonight" and "Saturday /
 *     birthday / next week".
 */
export const DEFAULT_ENGINE_MIX: Record<EngineId, Record<LaneId, number>> = {
  swipe: { "organic-now": 55, "organic-future": 15, "inorganic-now": 25, "inorganic-future": 5 },
  map:   { "organic-now": 65, "organic-future": 15, "inorganic-now": 15, "inorganic-future": 5 },
  memo:  { "organic-now": 45, "organic-future": 45, "inorganic-now": 5,  "inorganic-future": 5 },
};

/**
 * Retrieval knobs — RIPD (RAG intent-place data) and LIPD (LLM intent-place
 * data) sides of the match. The playground doesn't retrieve, so these bind
 * only when the engines go live; they live here so the page derives them.
 *
 * Defaults, argued:
 *   recallTopK 50 — recall must give the judge headroom (≥2× shortlist, the
 *     retrieve-then-rerank rule of thumb) and cover ~10–25% of a city-scale
 *     catalog (a launch city ≈ 200–500 places). 50 = 2.5× the shortlist.
 *   shortlistN 20 — one LLM call must hold every candidate + profile in a
 *     single prompt with bounded latency (~1–2 s) and per-query cost; the
 *     deck needs ~10 cards plus headroom for the 4-lane mix and dedupe. 20
 *     is the smallest n that never starves the mix.
 */
export const DEFAULT_RETRIEVAL = {
  /** RIPD — how many places pgvector recall returns. */
  recallTopK: 50,
  /** LIPD — how many recalled places the LLM judge re-scores. */
  shortlistN: 20,
};

// ── Persisted settings (app_settings.scoring_config) ────────────────────
// The Params tab saves ONE versioned blob. NULL in the DB means "following
// code defaults" — so default improvements propagate until someone saves an
// override. Reset-to-defaults loads these values into the form; Save writes
// the blob.

export type ScoringSettings = {
  v: 1;
  mix: Record<EngineId, Record<LaneId, number>>;
  retrieval: { recallTopK: number; shortlistN: number };
  ww: Pick<ScoresConfig, "distanceHalfKm" | "waitHalfH" | "waitExp" | "sessionH">;
  promos: Record<"zero" | "conservative" | "aggressive" | "dominant", number>;
};

export const DEFAULT_SCORING_SETTINGS: ScoringSettings = {
  v: 1,
  mix: DEFAULT_ENGINE_MIX,
  retrieval: DEFAULT_RETRIEVAL,
  ww: {
    distanceHalfKm: DEFAULT_SCORES_CONFIG.distanceHalfKm,
    waitHalfH: DEFAULT_SCORES_CONFIG.waitHalfH,
    waitExp: DEFAULT_SCORES_CONFIG.waitExp,
    sessionH: DEFAULT_SCORES_CONFIG.sessionH,
  },
  // Linear so relevance can beat money inside the paid lane; Zero = 0 because
  // there is nothing to promote (no discount) — the membership buys listing +
  // tools, generosity buys placement.
  promos: { zero: 0, conservative: 1, aggressive: 2, dominant: 3 },
};

function num(v: unknown, fallback: number, lo: number, hi: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
}

/**
 * Coerce a raw jsonb blob (or null) into a valid ScoringSettings — unknown
 * keys dropped, missing/malformed values fall back to defaults, everything
 * clamped to sane ranges. Null/garbage → pure defaults.
 */
export function coerceScoringSettings(raw: unknown): ScoringSettings {
  const d = DEFAULT_SCORING_SETTINGS;
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Record<string, unknown>;

  const mixIn = (r.mix ?? {}) as Record<string, Record<string, unknown>>;
  const mix = Object.fromEntries(
    (Object.keys(d.mix) as EngineId[]).map((e) => [
      e,
      Object.fromEntries(
        LANES.map((l) => [l.id, num(mixIn?.[e]?.[l.id], d.mix[e][l.id], 0, 100)]),
      ),
    ]),
  ) as ScoringSettings["mix"];

  const ret = (r.retrieval ?? {}) as Record<string, unknown>;
  const ww = (r.ww ?? {}) as Record<string, unknown>;
  const promos = (r.promos ?? {}) as Record<string, unknown>;

  return {
    v: 1,
    mix,
    retrieval: {
      recallTopK: num(ret.recallTopK, d.retrieval.recallTopK, 10, 200),
      shortlistN: num(ret.shortlistN, d.retrieval.shortlistN, 1, 50),
    },
    ww: {
      distanceHalfKm: num(ww.distanceHalfKm, d.ww.distanceHalfKm, 1, 20),
      waitHalfH: num(ww.waitHalfH, d.ww.waitHalfH, 0.5, 4),
      waitExp: num(ww.waitExp, d.ww.waitExp, 1, 5),
      sessionH: num(ww.sessionH, d.ww.sessionH, 0.5, 4),
    },
    promos: {
      zero: num(promos.zero, d.promos.zero, 0, 9),
      conservative: num(promos.conservative, d.promos.conservative, 0, 9),
      aggressive: num(promos.aggressive, d.promos.aggressive, 0, 9),
      dominant: num(promos.dominant, d.promos.dominant, 0, 9),
    },
  };
}

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
