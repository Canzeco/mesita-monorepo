// Recommendation Scores — the model behind Swipe · Map · Memo (draft).
//
// FIVE LAYERS. Every name in the model is defined exactly once, here; the
// Scoring Config page and the per-place Scores tab only render them.
//
//   4 SUBSCORES  ES · GP · RP · IC     the factors a Score multiplies
//      ↓
//   4 SCORES     ON · OF · IN · IF     one per Lane, carried by a CARD
//      ↓
//   CARDS        one (consumer, intent, place) with its four Scores
//      ↓
//   4 SUB-DECKS  each lane's top-MAX cards, generated independently
//      ↓
//   3 DECKS      Swipe · Map · Pre-Memo — the sub-decks merged, repeats out
//
// Deck composition takes per-lane MAXES, not quotas (DEFAULT_DECKS below):
// every lane fills its own sub-deck in parallel, then composeDeck merges the
// four sub-decks into ONE deck removing repeated places — NO backfill, so a
// deck is usually SMALLER than the sum of its maxes. That shrinkage is the
// design, not a defect: a card strong in two lanes appears once.
//
// ── THE SUB-SCORES ─────────────────────────────────────────────────────
//   ES  Embeddings Similarity  0–100  cosine(consumer+intent embedding,
//                                     place embedding). One tier — there is
//                                     no judge; everything is embeddings.
//   GP  Google Popularity      0–1    smooth volume × quality of the place's
//                                     google reviews. EARNED popularity.
//   RP  Rewards Promotions     0–3    the membership ladder; see ./strategies.
//                                     BOUGHT popularity.
//   IC  Intent Context         0–1    where(km) × when(opens_in, open_for) —
//                                     how the place sits in the intent's
//                                     numeric context. Now-mode lanes only.
//
// ONE pattern builds every Score — Match × popularity × moment, where the
// popularity is EARNED in the organic lanes and BOUGHT in the paid ones:
//
//   lane                 Score                        max
//   ON  organic   now    ON = ES × GP × IC            100
//   OF  organic   future OF = ES × GP                 100
//   IN  inorganic now    IN = ES × RP × IC            300
//   IF  inorganic future IF = ES × RP                 300
//
// ES reaches 0, and 0 zeroes every Score — "money can't buy irrelevance" is
// the whole reason Match multiplies.
//
// ── TEXT vs NUMBERS — who reads what ───────────────────────────────────
// ES reads TEXT only: an address, hours as written, a question that says
// "near Providencia tonight". It never receives computed numbers — no
// distance-km, no hours-until-open, no review counts are written into its
// context. GP, RP and IC are the NUMERIC Subscores (review count × rating,
// live promo rates, km/hours) — they MULTIPLY ES; they never feed it.
//
// ENGINES ARE PIPELINE POLICIES, not formulas. Every engine runs the same
// ladder — ES recalls the top-K of the catalog, the four Scores are computed
// per card, the four sub-decks fill, and the deck merges. What differs per
// engine is its DECK COMPOSITION (DEFAULT_DECKS) and where INTENT-data comes
// from: Swipe and Map read the prebuilt taste embedding (Map adds the
// viewport); Memo synthesizes intent from the question at query time. Memo's
// deck is PRE-MEMO — the retrieval set the concierge consumes before it
// writes an answer (its RAG leg); the agent itself stays Memo. Place-data is
// always prebuilt by the Enricher. One place representation, one Match
// definition, three query policies.
//
// The lanes never compete: organic results rank by the ON/OF Scores, promoted
// slots by the IN/IF Scores, and each sorts only against itself, so their
// different ceilings (100 vs 300) are meaningless across. Cross-lane deck
// order is COMPOSITION (composeDeck), never score comparison. Note the
// inorganic Score IS the organic Score with bought popularity swapped in for
// earned — the paid lane is the earned one tilted by generosity.
//
// ── GP — SMOOTH POPULARITY (volume × quality) ──────────────────────────
//   volume  = log10(1 + reviews) / log10(1 + refCount)   clamped 0–1
//   quality = 1 / (1 + e^(−steep · (rating − mid)))      logistic in stars
//   GP      = volume × quality, floored for cold start
//
// Two designs were rejected on the way here (decision 2026-07-15):
//   · literal reviews × rating — FARMABLE: a 1★ review INCREASES the sum,
//     and rating is decorative (counts vary 50×, ratings 1.3× — it ranks
//     identically to review count alone on the real catalog);
//   · the old hard hinge max(0, rating − 3) — a cliff at 3★.
// volume × quality is smooth everywhere, monotone in both inputs, and the
// 1★-farm test fails as it should: 3.0★ × 10,000 reviews → quality ≈ 0.17.
//
// COLD START: reviews < minReviews → GP = max(raw, coldStartFloor) — a new
// place stays organically ALIVE at reduced weight. Missing google data is
// cold start too, NEVER neutral-1: IC's unknown→1 is "don't punish missing
// geo", but GP multiplies the organic lanes — neutral would rank a data-less
// place above a 4.5★ × 2,000-review institution. A well-reviewed bad place
// (many reviews, low stars) gets no rescue — the quality floor survives.
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
// IC is where × when, NOTHING ELSE — the daypart WHAT term was deleted in v9
// (decision 2026-07-15, reversing v7.4): ES alone carries semantic fit. v9.1
// renamed the Subscore WW → IC (Intent Context) — same knobs, same factors.
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

export const ES_MAX = 100;

/** Time resolves to half-hour blocks. */
export const TIME_BLOCK_H = 0.5;

// ── THE FOUR SUB-SCORES — the model's spine ────────────────────────────
// The persisted blob keys, the context registry and PIPELINE_CONTEXT are all
// keyed off these ids, so a Sub-Score can never be renamed on screen without
// its storage following.

export type SubScoreId = "es" | "gp" | "rp" | "ic";

/** ES — the one field-configurable Sub-Score (its context is CONFIG). */
export type ConfigurableSubScoreId = Extract<SubScoreId, "es">;

/** GP · RP · IC — inputs are structural (the numeric fields ARE the
 * function), so these are tuned by knobs, never by field selection. */
export type FixedSubScoreId = Exclude<SubScoreId, ConfigurableSubScoreId>;

/** RP's ceiling — the top rung of the membership ladder. */
export const RP_MAX = 3;

// ── IC — the intent context's knobs ────────────────────────────────────

export type IcParams = {
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
  /** Time-grid resolution, hours. 0.5 = 30-min blocks (the default belief). */
  timeBlockH: number;
};

// IC defaults, argued from what Mesita IS — not from what looked right on a
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
export const DEFAULT_IC_PARAMS: IcParams = {
  distanceHalfKm: 6,
  distanceExp: 1.6,
  waitHalfH: 1.5,
  waitExp: 2.5,
  sessionH: 1.5,
  timeBlockH: TIME_BLOCK_H,
};

// ── ES — the encoder's own params ──────────────────────────────────────
// Emulated feature-hash today; the real embedding model's dims when live.

export type EsParams = {
  /** Embedding dimensionality. */
  embedDims: number;
};

export const DEFAULT_ES_PARAMS: EsParams = { embedDims: 64 };

// ── GP — smooth popularity's params ────────────────────────────────────

export type GpParams = {
  /** Review count at which volume saturates to 1. */
  refCount: number;
  /** Star rating that earns quality 0.50 — the curve's midpoint. */
  qualityMid: number;
  /** Logistic steepness — how hard the curve separates 3★ from 4.5★. */
  qualitySteep: number;
  /** GP floor for unreviewed places — organically alive, at reduced weight. */
  coldStartFloor: number;
  /** The floor applies under this many reviews. */
  minReviews: number;
};

export const DEFAULT_GP_PARAMS: GpParams = {
  refCount: 5000,
  qualityMid: 3.8,
  qualitySteep: 2.0,
  coldStartFloor: 0.15,
  minReviews: 5,
};

/** GP itemized — every intermediate the Card Sim's ledger renders. */
export type GpParts = {
  /** Review count actually used (null/negative coerced to 0). */
  reviews: number;
  /** Rating actually used, or null when the place carries none. */
  rating: number | null;
  /** log10(1+reviews)/log10(1+refCount), clamped 0–1. */
  volume: number;
  /** Logistic of rating around qualityMid; 0 when rating is null. */
  quality: number;
  /** volume × quality, before the floor. */
  raw: number;
  /** Whether the cold-start floor fired. */
  floored: boolean;
  /** The Sub-Score, 0–1. */
  gp: number;
};

/**
 * GP — smooth volume × quality with a cold-start floor. Missing google data
 * is COLD START (reviews null → 0; rating null → quality 0), never neutral.
 */
export function gpParts(
  reviews: number | null | undefined,
  rating: number | null | undefined,
  p: GpParams = DEFAULT_GP_PARAMS,
): GpParts {
  const n = Math.max(
    0,
    Math.round(typeof reviews === "number" && Number.isFinite(reviews) ? reviews : 0),
  );
  const r = typeof rating === "number" && Number.isFinite(rating) ? rating : null;
  const volume =
    p.refCount <= 0 ? 0 : Math.max(0, Math.min(1, Math.log10(1 + n) / Math.log10(1 + p.refCount)));
  const quality = r == null ? 0 : 1 / (1 + Math.exp(-p.qualitySteep * (r - p.qualityMid)));
  const raw = volume * quality;
  const floored = n < p.minReviews && raw < p.coldStartFloor;
  const gp = floored ? p.coldStartFloor : raw;
  return { reviews: n, rating: r, volume, quality, raw, floored, gp };
}

/** GP as one number, 0–1. */
export function gpScore(
  reviews: number | null | undefined,
  rating: number | null | undefined,
  p: GpParams = DEFAULT_GP_PARAMS,
): number {
  return gpParts(reviews, rating, p).gp;
}

// ── IC — the intent context's functions ────────────────────────────────

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
export function whereScore(km: number | null, cfg: IcParams = DEFAULT_IC_PARAMS): number {
  if (km == null) return 1;
  return hill(km, cfg.distanceHalfKm, cfg.distanceExp);
}

/** wait — the cost of arriving `opensInH` hours from now, 0–1. Open now → 1. */
export function waitScore(opensInH: number, cfg: IcParams = DEFAULT_IC_PARAMS): number {
  return hill(quantizeH(opensInH, cfg.timeBlockH), cfg.waitHalfH, cfg.waitExp);
}

/** fit — is there time to complete the visit, 0–1. Caps at 1: enough is enough. */
export function fitScore(openForH: number, cfg: IcParams = DEFAULT_IC_PARAMS): number {
  if (cfg.sessionH <= 0) return 1;
  return Math.max(0, Math.min(1, quantizeH(openForH, cfg.timeBlockH) / cfg.sessionH));
}

/** when — wait × fit, 0–1. */
export function whenScore(
  opensInH: number,
  openForH: number,
  cfg: IcParams = DEFAULT_IC_PARAMS,
): number {
  return waitScore(opensInH, cfg) * fitScore(openForH, cfg);
}

// ── THE FOUR LANES ─────────────────────────────────────────────────────

export type LaneId = "organic-now" | "organic-future" | "inorganic-now" | "inorganic-future";

export type Lane = {
  id: LaneId;
  /** The two-letter code — the deck's card-type keys AND the UI badge text
   * both derive from this one field (never restate the mapping). */
  short: "on" | "of" | "in" | "if";
  /** "organic" | "inorganic" — which ranking this lane's Score feeds. */
  lane: "organic" | "inorganic";
  /** "now" | "future" — a property of the QUERY, not the place. */
  mode: "now" | "future";
  /** The Score's ceiling, for the `/N` an operator reads. */
  max: number;
};

/** The deck's card-type keys — on · of · in · if, from Lane.short. */
export type DeckKey = Lane["short"];

export const LANES: readonly Lane[] = [
  { id: "organic-now",      short: "on", lane: "organic",   mode: "now",    max: ES_MAX },
  { id: "organic-future",   short: "of", lane: "organic",   mode: "future", max: ES_MAX },
  { id: "inorganic-now",    short: "in", lane: "inorganic", mode: "now",    max: ES_MAX * RP_MAX },
  { id: "inorganic-future", short: "if", lane: "inorganic", mode: "future", max: ES_MAX * RP_MAX },
];

/** DeckKeys in canonical order (on · of · in · if) — blob key order too. */
export const DECK_KEYS: readonly DeckKey[] = LANES.map((l) => l.short);

/** A lane's Score in the model's shorthand — e.g. "ES·RP·IC". */
export function laneFormula(lane: Lane): string {
  const parts: string[] = ["ES", lane.lane === "organic" ? "GP" : "RP"];
  if (lane.mode === "now") parts.push("IC");
  return parts.join("·");
}

export type LaneInputs = {
  /** 0–100 — Embeddings Similarity. */
  es: number;
  /** 0–1 — Google Popularity (the organic lanes' multiplier). */
  gp: number;
  /** 0–RP_MAX — Rewards Promotions (the inorganic lanes' multiplier). */
  rp: number;
  /** 0–1 — Intent Context (now-mode lanes only). */
  ic: number;
};

/** One lane's Score. ES multiplies un-floored, so 0 relevance zeroes it. */
export function laneScore(lane: Lane, i: LaneInputs): number {
  const es = Math.max(0, Math.min(ES_MAX, i.es));
  const popularity = lane.lane === "organic" ? i.gp : i.rp;
  const moment = lane.mode === "now" ? i.ic : 1;
  return es * popularity * moment;
}

// ── ENGINES ────────────────────────────────────────────────────────────

export type EngineId = "swipe" | "map" | "memo";

export type EnginePolicy = {
  id: EngineId;
  engine: "Swipe" | "Map" | "Memo";
  /** The DECK this engine composes. Memo's is PRE-MEMO — the retrieval set
   * the concierge consumes before answering; the agent itself stays Memo. */
  deck: "Swipe" | "Map" | "Pre-Memo";
  /** The pipeline — a fact of the architecture, not a hyperparameter. */
  policy: string;
  intent: string;
};

// Engines don't own formulas — every engine recalls with ES, computes the
// four Scores per card, and composes its deck from the per-lane counts. What
// differs per engine is intent-data and its DECK COMPOSITION (DEFAULT_DECKS).
export const ENGINE_POLICIES: readonly EnginePolicy[] = [
  { id: "swipe", engine: "Swipe", deck: "Swipe",    policy: "ES recalls top-K → 4 Scores → sub-decks merge", intent: "prebuilt taste embedding" },
  { id: "map",   engine: "Map",   deck: "Map",      policy: "ES recalls top-K → 4 Scores → sub-decks merge", intent: "taste embedding + viewport" },
  { id: "memo",  engine: "Memo",  deck: "Pre-Memo", policy: "ES recalls top-K → 4 Scores → sub-decks merge", intent: "synthesized from the question, per query" },
];

// ── DECK COMPOSITION — per-lane MAXES, not quotas ──────────────────────

/** MAX cards each lane's sub-deck may contribute to one engine's deck. */
export type DeckMaxes = Record<DeckKey, number>;

export type Decks = Record<EngineId, DeckMaxes>;

/** Ceiling on a per-lane max — the range table, mirrored in the update EF. */
export const DECK_COUNT_MAX = 20;

/**
 * Deck composition defaults — per-lane MAXES. A lane's sub-deck takes up to
 * this many cards; the merged deck is usually SMALLER (dedupe, no backfill).
 * Each row is still the product of the same two beliefs:
 *
 * PAID SHARE — by trust-sensitivity of the surface. "Visibility follows
 * generosity" must materialise as real slots, but "money can't buy
 * irrelevance" caps how many:
 *   Swipe 3/12 (25%) — the deck is natural promoted inventory (feed
 *     convention), and a Mesita "ad" is consumer-positive: the promoted card
 *     carries the BIGGER discount.
 *   Map 2/12 (17%) — promoted pins are an accepted map convention, but
 *     spatial browsing is task-driven; lighter touch.
 *   Memo 1/8 (12.5%) — a concierge answering with paid results is the most
 *     trust-sensitive surface on the product. ONE paid answer keeps the
 *     membership promise honest without polluting answers.
 *
 * NOW SHARE — by the surface's temporal intent (the runtime mode still
 * follows the actual query; this is the prior): Swipe skews "tonight" with a
 * save-for-later tail; Map is mostly "what's around me"; Memo splits between
 * "tonight" and "Saturday / birthday / next week".
 */
export const DEFAULT_DECKS: Decks = {
  swipe: { on: 7, of: 2, in: 2, if: 1 },
  map:   { on: 8, of: 2, in: 1, if: 1 },
  memo:  { on: 4, of: 3, in: 1, if: 0 },
};

// ── composeDeck — sub-decks, then merge ────────────────────────────────
// Lanes never compete on score, so cross-lane deck order is COMPOSITION:
//
//   SUB-DECKS (independent, in parallel when live) — each lane ranks the
//   whole pool by its own Score (ties by id, so the plan is deterministic),
//   drops Score ≤ 0, and takes up to its MAX. No cross-lane dedupe here —
//   the same place may sit in several sub-decks.
//
//   MERGE (dedupe, NO backfill) — the four sub-decks merge into ONE deck,
//   repeated places removed. A duplicated card keeps its PAID copy (merge
//   order in → if → on → of) — "visibility follows generosity" carried into
//   the merge. Nothing backfills a merged-away card, so the deck is usually
//   SMALLER than the sum of the maxes: maxes are ceilings, not quotas.
//
//   ORDER (presentation) — organic stream = ON cards by ON Score, then OF by
//   OF Score; paid card k (1-based) inserts after organic card ⌈k·G/(P+1)⌉.
//   Slot 1 is always organic and no two paid cards sit adjacent while
//   P ≤ G; a paid surplus appends at the tail and flags degradedSpacing
//   instead of silently reordering.

/** One place's four Scores, keyed by DeckKey. */
export type DeckCandidate = { id: string; scores: Record<DeckKey, number> };

export type SubDeckFill = {
  /** The lane's configured ceiling. */
  max: number;
  /** Candidates with Score > 0 in this lane (pool-wide). */
  eligible: number;
  /** min(eligible, max) — the sub-deck as generated, before the merge. */
  subDeck: number;
  /** Cards this lane actually placed in the merged deck. */
  contributed: number;
  /** Sub-deck cards dropped at merge — same place kept by an earlier lane. */
  mergedAway: number;
};

export type DeckSlot = {
  id: string;
  /** The lane whose sub-deck this card belongs to — its type badge. */
  laneKey: DeckKey;
  /** That lane's Score for this place. */
  score: number;
  paid: boolean;
};

export type DeckPlan = {
  /** The four sub-decks AS GENERATED — including cards later merged away. */
  subDecks: Record<DeckKey, DeckSlot[]>;
  /** The merged, ordered deck. */
  slots: DeckSlot[];
  fills: Record<DeckKey, SubDeckFill>;
  /** True when the paid cards couldn't be spaced (P > G or no organics). */
  degradedSpacing: boolean;
};

/** Merge priority — a duplicated card keeps its PAID copy. */
const MERGE_ORDER: readonly DeckKey[] = ["in", "if", "on", "of"];

export function composeDeck(
  candidates: readonly DeckCandidate[],
  maxes: DeckMaxes,
): DeckPlan {
  // 1 · Sub-decks — each lane independently takes its top-max.
  const subDecks = {} as Record<DeckKey, DeckSlot[]>;
  const fills = {} as Record<DeckKey, SubDeckFill>;
  for (const lane of LANES) {
    const key = lane.short;
    const max = Math.max(0, Math.round(maxes[key] ?? 0));
    const paid = lane.lane === "inorganic";
    const ranked = candidates
      .filter((c) => (c.scores[key] ?? 0) > 0)
      .slice()
      .sort((a, b) => b.scores[key] - a.scores[key] || (a.id < b.id ? -1 : 1));
    subDecks[key] = ranked
      .slice(0, max)
      .map((c) => ({ id: c.id, laneKey: key, score: c.scores[key], paid }));
    fills[key] = {
      max,
      eligible: ranked.length,
      subDeck: Math.min(ranked.length, max),
      contributed: 0,
      mergedAway: 0,
    };
  }

  // 2 · Merge — dedupe by place, paid copy wins, NO backfill.
  const seen = new Set<string>();
  const kept = { on: [], of: [], in: [], if: [] } as Record<DeckKey, DeckSlot[]>;
  for (const key of MERGE_ORDER) {
    for (const slot of subDecks[key]) {
      if (seen.has(slot.id)) {
        fills[key].mergedAway++;
        continue;
      }
      seen.add(slot.id);
      kept[key].push(slot);
      fills[key].contributed++;
    }
  }

  // 3 · Order — paid cards spaced through the organic stream.
  const organic = [...kept.on, ...kept.of];
  const paidCards = [...kept.in, ...kept.if];
  const G = organic.length;
  const P = paidCards.length;

  const slots: DeckSlot[] = [];
  if (P === 0 || G === 0) {
    slots.push(...organic, ...paidCards);
  } else {
    let pi = 0;
    for (let oi = 0; oi < G; oi++) {
      slots.push(organic[oi]);
      while (pi < P && Math.ceil(((pi + 1) * G) / (P + 1)) === oi + 1) {
        slots.push(paidCards[pi]);
        pi++;
      }
    }
    while (pi < P) slots.push(paidCards[pi++]);
  }

  return { subDecks, slots, fills, degradedSpacing: P > 0 && (G === 0 || P > G) };
}

/**
 * Retrieval knob — how wide ES recall casts. The playground doesn't
 * retrieve, so it binds only when the engines go live; it lives here so the
 * page derives it.
 *
 * recallTopK 50 — recall must give the deck headroom over its size (a
 * 12-card deck from 50 candidates survives dedupe and zero-Score
 * exclusions) and cover ~10–25% of a city-scale catalog (a launch city ≈
 * 200–500 places).
 */
export const DEFAULT_RETRIEVAL = {
  /** How many places pgvector recall returns for scoring. */
  recallTopK: 50,
};

// ── CONTEXT FIELD REGISTRY — the configurable pipeline ──────────────────
// Every TEXT field ES could read, with a stable key. Which of these ES
// actually receives is CONFIG (ContextConfig below, persisted in the blob):
// the admin toggles fields and the playground assembles its documents from
// exactly the enabled set — so a toggle visibly changes the embedding, the
// cosine, and the ranking. GP, RP and IC are the FixedSubScoreIds — not
// field-configurable; their behavior knobs live above.

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
  { key: "consumer.name",    side: "consumer", label: "name (first)",                status: "live", note: "identity flavor; noise for an embedding" },
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
  { key: "place.rating",      side: "place",   label: "google rating + review count", status: "live", note: "proof is GP's job now (numeric) — toggling this ALSO embeds it as text" },
  { key: "place.hours_text",  side: "place",   label: "hours (as text)",             status: "live", note: "text only — numeric hours live in IC" },
  { key: "place.reviews",     side: "place",   label: "review snippets",             status: "planned" },
  { key: "place.price",       side: "place",   label: "price level",                 status: "planned" },
];

export const CONTEXT_KEYS: ReadonlySet<string> = new Set(CONTEXT_FIELDS.map((f) => f.key));

/** Which fields ES reads — the configurable half of the pipeline. Keyed by
 * ConfigurableSubScoreId, so the blob key always follows the Sub-Score name. */
export type ContextConfig = Record<ConfigurableSubScoreId, string[]>;

// The default follows the encoder's economics: ES embeds a LEAN taste+intent
// document — names, follower counts and proof lines are noise in a cosine
// (and proof is GP's job now, numerically). Planned fields default off.
// Arrays kept SORTED — the canonical order everywhere (form state sorts too),
// so key order can never fake an unsaved-changes diff.
export const DEFAULT_CONTEXT_CONFIG: ContextConfig = {
  es: [
    "consumer.taste", "consumer.class", "consumer.age", "consumer.sex", "consumer.country",
    "intent.query", "intent.time", "intent.zone", "intent.party",
    "place.name", "place.category", "place.zone_city", "place.tags", "place.description",
  ].sort(),
};

// ── Persisted settings (app_settings.scoring_config) ────────────────────
// The Subscores tab saves ONE versioned blob, keyed by the names above: the
// deck maxes, ES recall + encoder params, and the three fixed Subscores'
// knobs. NULL in the DB means "following code defaults" — so default
// improvements propagate until someone saves an override. Reset-to-defaults
// loads these values into the form; Save writes the blob.
//
// RANGE TABLE (mirrored VERBATIM in admin-web-update-scoring-config):
//   decks.*.*         0–20 int        retrieval.recallTopK  10–200
//   es.embedDims      16–256 int
//   gp.refCount       100–100000 int  gp.qualityMid      1–5
//   gp.qualitySteep   0.1–10          gp.coldStartFloor  0–1
//   gp.minReviews     0–1000 int
//   rp.*              0–9
//   ic.distanceHalfKm 1–20 · distanceExp 1–3 · waitHalfH 0.5–4 ·
//   ic.waitExp 1–5 · sessionH 0.5–4 · timeBlockH 0.25–1

export type ScoringSettings = {
  v: 3;
  decks: Decks;
  retrieval: { recallTopK: number };
  es: EsParams;
  gp: GpParams;
  rp: Record<"zero" | "conservative" | "aggressive" | "dominant", number>;
  ic: IcParams;
  context: ContextConfig;
};

export const DEFAULT_SCORING_SETTINGS: ScoringSettings = {
  v: 3,
  decks: DEFAULT_DECKS,
  retrieval: DEFAULT_RETRIEVAL,
  es: DEFAULT_ES_PARAMS,
  gp: DEFAULT_GP_PARAMS,
  // Linear so relevance can beat money inside the paid lane; Zero = 0 because
  // there is nothing to promote (no discount) — the membership buys listing +
  // tools, generosity buys placement.
  rp: { zero: 0, conservative: 1, aggressive: 2, dominant: 3 },
  ic: DEFAULT_IC_PARAMS,
  context: DEFAULT_CONTEXT_CONFIG,
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
 * clamped to the range table. Null/garbage → pure defaults. Construction
 * key order MATCHES the provider's `current` literal — the dirty diff is
 * JSON.stringify equality.
 */
export function coerceScoringSettings(raw: unknown): ScoringSettings {
  const d = DEFAULT_SCORING_SETTINGS;
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Record<string, unknown>;

  const decksIn = (r.decks ?? {}) as Record<string, Record<string, unknown>>;
  const decks = Object.fromEntries(
    (Object.keys(d.decks) as EngineId[]).map((e) => [
      e,
      Object.fromEntries(
        DECK_KEYS.map((k) => [
          k,
          Math.round(num(decksIn?.[e]?.[k], d.decks[e][k], 0, DECK_COUNT_MAX)),
        ]),
      ),
    ]),
  ) as Decks;

  const ret = (r.retrieval ?? {}) as Record<string, unknown>;
  const es = (r.es ?? {}) as Record<string, unknown>;
  const gp = (r.gp ?? {}) as Record<string, unknown>;
  const rp = (r.rp ?? {}) as Record<string, unknown>;
  const ic = (r.ic ?? {}) as Record<string, unknown>;
  const ctx = (r.context ?? {}) as Record<string, unknown>;

  return {
    v: 3,
    decks,
    retrieval: {
      recallTopK: num(ret.recallTopK, d.retrieval.recallTopK, 10, 200),
    },
    es: {
      embedDims: Math.round(num(es.embedDims, d.es.embedDims, 16, 256)),
    },
    gp: {
      refCount: Math.round(num(gp.refCount, d.gp.refCount, 100, 100000)),
      qualityMid: num(gp.qualityMid, d.gp.qualityMid, 1, 5),
      qualitySteep: num(gp.qualitySteep, d.gp.qualitySteep, 0.1, 10),
      coldStartFloor: num(gp.coldStartFloor, d.gp.coldStartFloor, 0, 1),
      minReviews: Math.round(num(gp.minReviews, d.gp.minReviews, 0, 1000)),
    },
    rp: {
      zero: num(rp.zero, d.rp.zero, 0, 9),
      conservative: num(rp.conservative, d.rp.conservative, 0, 9),
      aggressive: num(rp.aggressive, d.rp.aggressive, 0, 9),
      dominant: num(rp.dominant, d.rp.dominant, 0, 9),
    },
    ic: {
      distanceHalfKm: num(ic.distanceHalfKm, d.ic.distanceHalfKm, 1, 20),
      distanceExp: num(ic.distanceExp, d.ic.distanceExp, 1, 3),
      waitHalfH: num(ic.waitHalfH, d.ic.waitHalfH, 0.5, 4),
      waitExp: num(ic.waitExp, d.ic.waitExp, 1, 5),
      sessionH: num(ic.sessionH, d.ic.sessionH, 0.5, 4),
      timeBlockH: num(ic.timeBlockH, d.ic.timeBlockH, 0.25, 1),
    },
    context: {
      es: coerceContextKeys(ctx.es, d.context.es),
    },
  };
}

// ── PIPELINE CONTEXT — the FIXED data-access contracts ──────────────────
// ES's contract is CONFIG (CONTEXT_FIELDS + ContextConfig above — the admin
// toggles what it reads and the playground honors it). The FixedSubScoreIds
// keep fixed contracts: their inputs are structural — GP reads only the
// google aggregates, RP only the live rates, IC only geo + open windows.
// Tuned by the knobs, not by field selection.

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
  gp: {
    consumer: [{ field: "—", status: "live" }],
    intent: [{ field: "—", status: "live" }],
    place: [
      { field: "google_review_count (NUMERIC)", status: "live" },
      { field: "google_stars_overall (NUMERIC)", status: "live" },
      { field: "→ volume × quality → floor", status: "live" },
    ],
  },
  rp: {
    consumer: [{ field: "— (never; rates stay blended)", status: "live" }],
    intent: [{ field: "—", status: "live" }],
    place: [
      { field: "welcome/returning × free/premium rates (projects)", status: "live" },
      { field: `→ posture → rung 0–${RP_MAX}`, status: "live" },
    ],
  },
  ic: {
    consumer: [{ field: "— (location arrives via intent)", status: "live" }],
    intent: [
      { field: "location lat/lng (NUMERIC)", status: "live" },
      { field: "target time (NUMERIC)", status: "live" },
    ],
    place: [
      { field: "lat/lng (NUMERIC)", status: "live" },
      { field: "hours → open windows (NUMERIC)", status: "live" },
    ],
  },
};
