// Recommendation Scores — the model behind Swipe · Map · Memo (draft).
//
// THREE LEVELS. Every name in the model is defined exactly once, here; the
// Scoring Config page and the per-place Scores tab only render them.
//
//   4 LANES       ON · OF · IN · IF     organic|inorganic × now|future
//      ↓
//   4 SCORES      one per lane          what a surface actually ranks by
//      ↑
//   4 SUB-SCORES  FM · SM · WWW · BP    the factors a Score multiplies
//
// ── THE SUB-SCORES ─────────────────────────────────────────────────────
//   FM   Fast-Match      0–100  cosine(intent embedding, place embedding).
//                               Cheap; runs over the whole catalog in
//                               pgvector.
//   SM   Slow-Match      0–100  a judge reads intent + place profile and
//                               scores it. Expensive; shortlist only.
//   WWW  the moment      0–1    what(daypart) × where(km) × when(opens_in,
//                               open_for). Now-mode lanes only.
//   BP   Business Promo  0–3    the membership ladder; see ./strategies.
//
// ONE MATCH, TWO ESTIMATORS. FM and SM ask the same question — how well does
// this intent fit this place — at two fidelities. They are ALTERNATIVES in the
// Match slot, never co-factors, so every Score has two values:
//
//   lane                 Score      Fast tier    Slow tier
//   ON  organic   now    ON Score   FM·WWW       SM·WWW
//   OF  organic   future OF Score   FM           SM
//   IN  inorganic now    IN Score   FM·WWW·BP    SM·WWW·BP
//   IF  inorganic future IF Score   FM·BP        SM·BP
//
// The Slow column is the Fast column with SM swapped in for FM — nothing else
// moves. That symmetry is deliberate: fast and slow only disagree where the
// estimators disagree, which is exactly the disagreement the Swipe rerank
// exists to fix.
//
// FM and SM reach 0, and 0 zeroes every Score — "money can't buy irrelevance"
// is the whole reason Match multiplies.
//
// ── TEXT vs NUMBERS — who actually knows about where/when ─────────────
// Intent-data and place-data both carry where/when as TEXT — an address, hours
// as written, a question that says "near Providencia tonight". So FM/SM may
// pick up place- and time-flavor implicitly. That's redundant with WWW, and
// it's fine. What the match tiers NEVER receive is computed numbers: no
// distance-km, no hours-until-open are precomputed and written into their
// context. WWW is the only Sub-Score that computes where and when as numerical
// values — and it MULTIPLIES FM or SM; it never feeds them.
//
// ENGINES ARE PIPELINE POLICIES, not formulas. Every engine runs the SAME
// ladder — FM screens the catalog (top-K, with WWW·BP applied, so no SM calls
// are wasted on closed or far places) → SM sorts the shortlist. What differs
// per engine is its LANE MIX (DEFAULT_ENGINE_MIX) and where INTENT-data comes
// from: Swipe and Map read the prebuilt taste embedding (Map adds the
// viewport); Memo synthesizes intent from the question at query time.
// Place-data is always prebuilt by the Enricher. One place representation, one
// Match definition, three query policies.
//
// The lanes never compete: organic results rank by the ON/OF Scores, promoted
// slots by the IN/IF Scores, and each sorts only against itself, so their
// different ceilings (100 vs 300) are meaningless across. Note the inorganic
// Score IS the organic Score × BP — the paid lane is the earned one tilted by
// generosity.
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
// BREAK-EVEN (how far a mega-place's Match must fall before a well-matched
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
  /**
   * WHAT — what a place keeps when the moment is the wrong daypart for its
   * category (a brunch place at 23:00). Soft: the place is OPEN and a sharp
   * Match can still surface it for an explicit ask; it just shouldn't fill
   * now-decks. 0.3 = wrong hour costs ~2/3 — harsher than neutral, softer
   * than closed.
   */
  whatOffFactor: number;
  /** Time-grid resolution, hours. 0.5 = 30-min blocks (the default belief). */
  timeBlockH: number;
};

// WWW defaults, argued from what Mesita IS — not from what looked right on a
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
  whatOffFactor: 0.3,
  timeBlockH: TIME_BLOCK_H,
};

// ── Match-tier internal params — configurable, not constants ────────────
// The two estimators' own knobs. FM: the encoder's dimensionality (emulated
// feature-hash today; the real embedding model's dims when live). SM: the
// judge's rubric weights — what each structured judgment is worth. These were
// hardcoded (+15/+8/−18/±6, 64d) until v7.7; now they persist in the blob
// and every playground computes from them.

export type FmParams = {
  /** Embedding dimensionality. */
  embedDims: number;
};

export type SmParams = {
  /** + when the place's category is in the consumer+intent tokens. */
  catBonus: number;
  /** + when the place's zone is in the consumer+intent tokens. */
  zoneBonus: number;
  /** − when an occasion token clashes with the category (stored positive). */
  clashPenalty: number;
  /** ± judgment-nuance amplitude, stable per consumer×place pair. */
  nuanceAmp: number;
};

export const DEFAULT_FM_PARAMS: FmParams = { embedDims: 64 };

export const DEFAULT_SM_PARAMS: SmParams = {
  catBonus: 15,
  zoneBonus: 8,
  clashPenalty: 18,
  nuanceAmp: 6,
};

/**
 * WHAT — daypart suitability, 0–1. `fits` comes from the category↔daypart
 * map (cip.whatFit resolves it); unknown categories fit everything. The
 * moment is WWW = what × where × when — v7 briefly dropped WHAT on the
 * theory that "Match is the what"; wrong: Match is *semantic* what, this is
 * *temporal* what (brunch at 23:00 is semantically brunch, temporally off).
 */
export function whatScore(fits: boolean, cfg: ScoresConfig = DEFAULT_SCORES_CONFIG): number {
  return fits ? 1 : Math.max(0, Math.min(1, cfg.whatOffFactor));
}

/** Snap hours to the time grid (default 30-min blocks). Everything
 * time-shaped goes through this. */
export function quantizeH(hours: number, blockH: number = TIME_BLOCK_H): number {
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  if (blockH <= 0) return hours;
  return Math.round(hours / blockH) * blockH;
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
  return hill(quantizeH(opensInH, cfg.timeBlockH), cfg.waitHalfH, cfg.waitExp);
}

/** fit — is there time to complete the visit, 0–1. Caps at 1: enough is enough. */
export function fitScore(openForH: number, cfg: ScoresConfig = DEFAULT_SCORES_CONFIG): number {
  if (cfg.sessionH <= 0) return 1;
  return Math.max(0, Math.min(1, quantizeH(openForH, cfg.timeBlockH) / cfg.sessionH));
}

/** when — the moment, 0–1. */
export function whenScore(
  opensInH: number,
  openForH: number,
  cfg: ScoresConfig = DEFAULT_SCORES_CONFIG,
): number {
  return waitScore(opensInH, cfg) * fitScore(openForH, cfg);
}

// ── THE FOUR SUB-SCORES ────────────────────────────────────────────────
// These ids are the model's spine: the persisted blob keys, the context
// registry and PIPELINE_CONTEXT are all keyed off them, so a Sub-Score can
// never be renamed on screen without its storage following.

export type SubScoreId = "fm" | "sm" | "www" | "bp";

/** FM · SM — the two Match estimators, and the field-configurable Sub-Scores. */
export type MatchTierId = Extract<SubScoreId, "fm" | "sm">;

/** WWW · BP — inputs are structural (the numeric fields ARE the function), so
 * these are tuned by knobs, never by field selection. */
export type FixedSubScoreId = Exclude<SubScoreId, MatchTierId>;

export type MatchTier = {
  id: MatchTierId;
  /** The pipeline verb — "Fast screens → Slow sorts". */
  label: string;
  /** The Sub-Score's name, as rendered. */
  term: "FM" | "SM";
  detail: string;
};

/** One Match (intent × place), two estimators. Fast screens; Slow settles. */
export const MATCH_TIERS: readonly MatchTier[] = [
  { id: "fm", label: "Fast", term: "FM", detail: "Fast-Match · embeddings, cosine over the whole catalog" },
  { id: "sm", label: "Slow", term: "SM", detail: "Slow-Match · LLM judge, shortlist only" },
];

/** BP's ceiling — the top rung of the membership ladder. */
export const BP_MAX = 3;

// ── THE FOUR LANES ─────────────────────────────────────────────────────

export type LaneId = "organic-now" | "organic-future" | "inorganic-now" | "inorganic-future";

export type Lane = {
  id: LaneId;
  /** "organic" | "inorganic" — which ranking this lane's Score feeds. */
  lane: "organic" | "inorganic";
  /** "now" | "future" — a property of the QUERY, not the place. */
  mode: "now" | "future";
  /** The Score's ceiling, for the `/N` an operator reads. */
  max: number;
};

export const LANES: readonly Lane[] = [
  { id: "organic-now",      lane: "organic",   mode: "now",    max: MATCH_MAX },
  { id: "organic-future",   lane: "organic",   mode: "future", max: MATCH_MAX },
  { id: "inorganic-now",    lane: "inorganic", mode: "now",    max: MATCH_MAX * BP_MAX },
  { id: "inorganic-future", lane: "inorganic", mode: "future", max: MATCH_MAX * BP_MAX },
];

/** A lane's Score at one tier, in the model's shorthand — e.g. "SM·WWW·BP". */
export function laneFormula(lane: Lane, term: MatchTier["term"]): string {
  const parts: string[] = [term];
  if (lane.mode === "now") parts.push("WWW");
  if (lane.lane === "inorganic") parts.push("BP");
  return parts.join("·");
}

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
 * Retrieval knobs — how wide FM screens and how deep SM sorts. The playground
 * doesn't retrieve, so these bind only when the engines go live; they live
 * here so the page derives them.
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
  /** How many places pgvector recall returns for FM to screen. */
  recallTopK: 50,
  /** How many FM-screened places SM re-scores. */
  shortlistN: 20,
};

// ── CONTEXT FIELD REGISTRY — the configurable pipeline ──────────────────
// Every TEXT field the match tiers could read, with a stable key. Which of
// these FM and SM actually receive is CONFIG (ContextConfig below, persisted
// in the blob): the admin toggles fields per Sub-Score and the playground
// assembles its documents from exactly the enabled set — so a toggle visibly
// changes the embedding, the cosine, and the ranking. WWW and BP are the
// FixedSubScoreIds — not field-configurable; their behavior knobs live above.

export type ContextSide = "consumer" | "intent" | "place";

export type ContextFieldDef = {
  /** Stable key, "side.name" — what ContextConfig stores. */
  key: string;
  side: ContextSide;
  label: string;
  /** "live" = data exists and the doc builders consume it; "planned" = in the contract, no data yet. */
  status: "live" | "planned";
  note?: string;
};

export const CONTEXT_FIELDS: readonly ContextFieldDef[] = [
  // Consumer — the barely-mutable half of the query side.
  { key: "consumer.name",    side: "consumer", label: "name (first)",                status: "live", note: "identity flavor for the judge; noise for an embedding" },
  { key: "consumer.sex",     side: "consumer", label: "sex",                         status: "live" },
  { key: "consumer.age",     side: "consumer", label: "age (from birthday, server-side)", status: "live" },
  { key: "consumer.country", side: "consumer", label: "country",                     status: "live" },
  { key: "consumer.class",   side: "consumer", label: "class (free/premium)",        status: "live" },
  { key: "consumer.ig",      side: "consumer", label: "IG followers (magnetism)",    status: "live" },
  { key: "consumer.taste",   side: "consumer", label: "taste tokens (saved + visited)", status: "live" },
  { key: "consumer.history", side: "consumer", label: "history sentence (saves · visits)", status: "live" },
  // Intent — the per-query half. Where/when appear as TEXT here by design.
  { key: "intent.query",     side: "intent",   label: "what / occasion (question text)", status: "live" },
  { key: "intent.time",      side: "intent",   label: "day + time (as text)",        status: "live" },
  { key: "intent.zone",      side: "intent",   label: "near-zone (as text)",         status: "live" },
  { key: "intent.party",     side: "intent",   label: "party size",                  status: "live" },
  { key: "intent.budget",    side: "intent",   label: "budget",                      status: "planned" },
  // Place — the Enricher-built profile.
  { key: "place.name",        side: "place",   label: "name",                        status: "live" },
  { key: "place.category",    side: "place",   label: "category",                    status: "live" },
  { key: "place.zone_city",   side: "place",   label: "zone · city",                 status: "live" },
  { key: "place.tags",        side: "place",   label: "tags",                        status: "live" },
  { key: "place.description", side: "place",   label: "description",                 status: "live" },
  { key: "place.rating",      side: "place",   label: "google rating + review count", status: "live" },
  { key: "place.hours_text",  side: "place",   label: "hours (as text)",             status: "live", note: "text only — numeric hours live in WWW" },
  { key: "place.reviews",     side: "place",   label: "review snippets",             status: "planned" },
  { key: "place.price",       side: "place",   label: "price level",                 status: "planned" },
];

export const CONTEXT_KEYS: ReadonlySet<string> = new Set(CONTEXT_FIELDS.map((f) => f.key));

/** Which fields each match tier reads — the configurable half of the pipeline.
 * Keyed by MatchTierId, so the blob key always follows the Sub-Score name. */
export type ContextConfig = Record<MatchTierId, string[]>;

// Defaults follow the tiers' economics: FM embeds a LEAN taste+intent document
// (names, follower counts and proof lines are noise in a cosine); SM is the
// expensive judge and reads EVERYTHING that exists. Planned fields default off
// — they can be toggled on, but contribute nothing until the data exists.
// Arrays kept SORTED — the canonical order everywhere (form state sorts too),
// so key order can never fake an unsaved-changes diff.
export const DEFAULT_CONTEXT_CONFIG: ContextConfig = {
  fm: [
    "consumer.taste", "consumer.class", "consumer.age", "consumer.sex", "consumer.country",
    "intent.query", "intent.time", "intent.zone", "intent.party",
    "place.name", "place.category", "place.zone_city", "place.tags", "place.description",
  ].sort(),
  sm: CONTEXT_FIELDS.filter((f) => f.status === "live").map((f) => f.key).sort(),
};

// ── Persisted settings (app_settings.scoring_config) ────────────────────
// The Pipeline tab saves ONE versioned blob, keyed by the names above: the
// three Sub-Scores with knobs (`www`, `bp`, plus `fm`/`sm` params) sit at the
// top level, and `context` holds the two match tiers' field selections. NULL
// in the DB means "following code defaults" — so default improvements
// propagate until someone saves an override. Reset-to-defaults loads these
// values into the form; Save writes the blob.

export type ScoringSettings = {
  v: 1;
  mix: Record<EngineId, Record<LaneId, number>>;
  retrieval: { recallTopK: number; shortlistN: number };
  www: ScoresConfig;
  bp: Record<"zero" | "conservative" | "aggressive" | "dominant", number>;
  context: ContextConfig;
  fm: FmParams;
  sm: SmParams;
};

export const DEFAULT_SCORING_SETTINGS: ScoringSettings = {
  v: 1,
  mix: DEFAULT_ENGINE_MIX,
  retrieval: DEFAULT_RETRIEVAL,
  www: DEFAULT_SCORES_CONFIG,
  // Linear so relevance can beat money inside the paid lane; Zero = 0 because
  // there is nothing to promote (no discount) — the membership buys listing +
  // tools, generosity buys placement.
  bp: { zero: 0, conservative: 1, aggressive: 2, dominant: 3 },
  context: DEFAULT_CONTEXT_CONFIG,
  fm: DEFAULT_FM_PARAMS,
  sm: DEFAULT_SM_PARAMS,
};

// Sorted + deduped so key order can never fake a settings diff. An empty
// array is a VALID (degenerate) config — everything off; only a non-array
// falls back to defaults.
function coerceContextKeys(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return [...fallback].sort();
  return [...new Set(v.filter((k): k is string => typeof k === "string" && CONTEXT_KEYS.has(k)))]
    .sort();
}

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
  const www = (r.www ?? {}) as Record<string, unknown>;
  const bp = (r.bp ?? {}) as Record<string, unknown>;
  const ctx = (r.context ?? {}) as Record<string, unknown>;
  const fm = (r.fm ?? {}) as Record<string, unknown>;
  const sm = (r.sm ?? {}) as Record<string, unknown>;

  return {
    v: 1,
    mix,
    retrieval: {
      recallTopK: num(ret.recallTopK, d.retrieval.recallTopK, 10, 200),
      shortlistN: num(ret.shortlistN, d.retrieval.shortlistN, 1, 50),
    },
    www: {
      distanceHalfKm: num(www.distanceHalfKm, d.www.distanceHalfKm, 1, 20),
      distanceExp: num(www.distanceExp, d.www.distanceExp, 1, 3),
      waitHalfH: num(www.waitHalfH, d.www.waitHalfH, 0.5, 4),
      waitExp: num(www.waitExp, d.www.waitExp, 1, 5),
      sessionH: num(www.sessionH, d.www.sessionH, 0.5, 4),
      whatOffFactor: num(www.whatOffFactor, d.www.whatOffFactor, 0, 1),
      timeBlockH: num(www.timeBlockH, d.www.timeBlockH, 0.25, 1),
    },
    bp: {
      zero: num(bp.zero, d.bp.zero, 0, 9),
      conservative: num(bp.conservative, d.bp.conservative, 0, 9),
      aggressive: num(bp.aggressive, d.bp.aggressive, 0, 9),
      dominant: num(bp.dominant, d.bp.dominant, 0, 9),
    },
    context: {
      fm: coerceContextKeys(ctx.fm, d.context.fm),
      sm: coerceContextKeys(ctx.sm, d.context.sm),
    },
    fm: {
      embedDims: Math.round(num(fm.embedDims, d.fm.embedDims, 16, 256)),
    },
    sm: {
      catBonus: num(sm.catBonus, d.sm.catBonus, 0, 30),
      zoneBonus: num(sm.zoneBonus, d.sm.zoneBonus, 0, 20),
      clashPenalty: num(sm.clashPenalty, d.sm.clashPenalty, 0, 30),
      nuanceAmp: Math.round(num(sm.nuanceAmp, d.sm.nuanceAmp, 0, 12)),
    },
  };
}

export type LaneInputs = {
  /** 0–100 — FM or SM, whichever tier the caller is scoring. */
  match: number;
  /** 0–1 — WWW's where. */
  where: number;
  /** 0–1 — WWW's when. */
  when: number;
  /** 0–1 — WWW's what (daypart suitability). Omit for 1 (no penalty). */
  what?: number;
  /** 0–BP_MAX. */
  bp: number;
};

/** One lane's Score. Match multiplies un-floored, so 0 relevance zeroes it. */
export function laneScore(lane: Lane, i: LaneInputs): number {
  const m = Math.max(0, Math.min(MATCH_MAX, i.match));
  const moment = lane.mode === "now" ? (i.what ?? 1) * i.where * i.when : 1;
  const paid = lane.lane === "inorganic" ? i.bp : 1;
  return m * moment * paid;
}

// ── PIPELINE CONTEXT — the FIXED data-access contracts ──────────────────
// FM/SM contracts are CONFIG now (CONTEXT_FIELDS + ContextConfig above — the
// admin toggles what each tier reads and the playground honors it). The
// FixedSubScoreIds keep fixed contracts: their inputs are structural — WWW
// alone reads NUMBERS (that boundary is the model's debuggability), and BP
// reads only the live rates. Tuned by the knobs, not by field selection.

export type ContextField = {
  field: string;
  status: "live" | "planned" | "spec";
  note?: string;
};

export type SubScoreContext = {
  consumer: ContextField[];
  intent: ContextField[];
  place: ContextField[];
};

export const PIPELINE_CONTEXT: Record<FixedSubScoreId, SubScoreContext> = {
  www: {
    consumer: [{ field: "— (location arrives via intent)", status: "live" }],
    intent: [
      { field: "location lat/lng (NUMERIC)", status: "live" },
      { field: "target time (NUMERIC)", status: "live" },
    ],
    place: [
      { field: "lat/lng (NUMERIC)", status: "live" },
      { field: "hours → open windows (NUMERIC)", status: "live" },
      { field: "category → daypart map (WHAT)", status: "live" },
    ],
  },
  bp: {
    consumer: [{ field: "— (never; rates stay blended)", status: "live" }],
    intent: [{ field: "—", status: "live" }],
    place: [
      { field: "welcome/returning × free/premium rates (projects)", status: "live" },
      { field: `→ posture → rung 0–${BP_MAX}`, status: "live" },
    ],
  },
};
