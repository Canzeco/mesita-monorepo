// Recommendation Scores v11 — the model behind Swipe · Map · Memo.
// Master spec: Notion 🎲 Lineup (blob v11, 2026-07-21).
//
// FIVE SUBSCORES → THREE LANES → ONE FINAL DECK.
//
//   EM  Embeddings Match     [0,1]  cosine(place vector, consumer+intent
//                                   vector), clamped max(0, cos). Encoder:
//                                   OpenAI text-embedding-3-small @ 1536
//                                   (emulated feature-hash in the playground).
//                                   That (the free-text ask) is EM's only.
//   SM  Structured Match     [0,1]  where × when × what — ONE hyperparam
//                                   per intent axis (v11): where = distance
//                                   tolerance · when = patience over a binary
//                                   2×24×7 openness array · what = one tol
//                                   (super = t, none = t²).
//   GP  Google Popularity    [0,1]  min(1, ln(1 + r^ratingPow · n) / lnCeiling)
//                                   — star mass with a rating exponent
//                                   (default 1, max 2), log-squashed.
//   RP  Rewards Promotions   [0,1]  the membership posture as a rung —
//                                   0.1 · 0.4 · 0.7 · 1.0. No literal 0:
//                                   non-members never ENTER the paid lanes
//                                   (a lane filter, not a score); the zero-
//                                   posture member keeps a 0.1 whisper.
//   XX  Random Number        [0,1)  U^control, U ~ Uniform[0,1) drawn per
//                                   card per lane; control ∈ [0,5] is one
//                                   deck-wide knob. control 0 → XX ≡ 1 (off,
//                                   pure merit) · 5 → near-total chaos.
//                                   Higher control never changes WHO is
//                                   luckiest, only how much luck beats merit.
//
// Every subscore lands in [0,1], so a lane score (the product of its active
// subscores) is itself in [0,1].
//
//   lane        score                    merit source
//   Organic     EM · SM · GP · XX        earned (Google)
//   Inorganic   EM · SM · RP · XX        bought (Rewards)
//   Hybrid      EM · SM · GP · RP · XX   both
//
// EM and SM MULTIPLY — never blend (decision 2026-07-16): a 50/50 average
// would be compensatory, letting great vibes rescue a closed or cross-town
// place. The product keeps the veto: semantically dead OR structurally
// infeasible → the card dies. Relative strength, if ever needed, is exponent
// weights (EM^a · SM^b) — never an average.
//
// MERGE (locked 2026-07-16 · per-lane counts MESITA-659): the three lanes
// each rank the pool by their own score and take their own top-N — laneN is
// PER LANE ({ organic, inorganic, hybrid }; a lane at 0 is off). Round-robin
// O → I → H — identical for Swipe and Map — dedupe ON INSERT (keep the FIRST
// occurrence, drop later duplicates), NO backfill: the final deck is
// ≤ N_O + N_I + N_H and shrinks as lanes agree. Shrinkage is signal, not
// defect.
//
// ENGINES ARE CONTAINERS, not formulas: Swipe and Map compose the three
// lanes exactly as above and differ only in intent source (taste embedding;
// + viewport). Memo is free/dynamic — indexes + RAG, decomposing the five
// subscores however the question needs.
//
// ── SM = where × when × what ───────────────────────────────────────────
//   where = 1 / (1 + (km / tol)^exp) — CONTINUOUS, never a bucket.
//     km measured to the consumer's W: a REGION SET if zones/anchors were
//     named (inside any → 0; outside → distance from the nearest border),
//     else a POINT at GPS. tol is the CONSUMER'S distance-tolerance input
//     (the Where filter slider); unset → the admin's defaultTolKm knob —
//     a CONSUMER-OVERRIDABLE DEFAULT (GREEN in the console, like XX's
//     control: the admin sets the fallback, the user overrides per query;
//     when/what knobs have no consumer override). A named zone reuses 30%
//     (ZONE_SPILL_FRAC — a typed zone is a constraint, not a vibe). The
//     admin's ONE where knob is the exponent: exp = 3 → doubling distance
//     beyond tolerance costs 8× — the tail is honestly a soft gate. Zones
//     registry / metro sets are the backend build (MESITA-644 review,
//     D2–D11); the playground emulates W as the anchor point + zone match.
//   when = wait × fit over a binary OPENNESS ARRAY (2×24×7 half-hour slots
//     from intent time). ONE patience knob shapes both extremes: 0 = only
//     tolerant of open-now-for-a-while · 1 = tolerant of future opens and
//     short windows.
//   what — CATEGORICAL ladder over the intent's SET of categories / megas.
//     listed (or mega listed) → 1 · super → t · none → t² · nothing asked → 1.
//     ONE tolerance t generates both demotion rungs.
//
// THE INTENT HAS FOUR AXES — Where · When · What · THAT. The first three are
// the STRUCTURED asks (SM's inputs, above). THAT is the free-text ask — the
// TEXT half of the intent, EM's query (CONTEXT_FIELDS key intent.query) —
// and it NEVER reaches SM. Swipe and Map carry a That input alongside the
// structured filters; Memo synthesizes all four from the question.
// (Randomness is NOT an intent axis — it's XX's per-query control.)
//
// EVERY KNOB IS A BELIEF, NOT AN ESTIMATE — nothing here is fitted. Judge a
// change by its break-even, never by how far apart numbers land. Tune here;
// the Lineup Config page and the per-place Scores tab derive from this
// module and never restate a knob.

// ── THE FIVE SUBSCORES — the model's spine ─────────────────────────────
// Blob keys, playground labels and the fixed-contract registry all key off
// these ids, so a subscore can never be renamed on screen without its
// storage following.

export type SubscoreId = "em" | "sm" | "gp" | "rp" | "xx";

export type SubscoreDef = {
  id: SubscoreId;
  short: string;
  name: string;
  basis: string;
  range: string;
};

export const SUBSCORES: readonly SubscoreDef[] = [
  { id: "em", short: "EM", name: "Embeddings Match",   basis: "cosine(place vector, consumer+intent vector)", range: "0–1" },
  { id: "sm", short: "SM", name: "Structured Match",   basis: "where × when × what — structured asks vs place facts", range: "0–1" },
  { id: "gp", short: "GP", name: "Google Popularity",  basis: "ln(1 + rating × reviews) / ceiling", range: "0–1" },
  { id: "rp", short: "RP", name: "Rewards Promotions", basis: "membership posture → rung", range: "0–1" },
  { id: "xx", short: "XX", name: "Random Number",      basis: "U^control · per card per lane", range: "0–1" },
];

export const SUBSCORE_BY_ID = Object.fromEntries(SUBSCORES.map((s) => [s.id, s])) as Record<
  SubscoreId,
  SubscoreDef
>;

/** SM · GP · RP · XX — the subscores whose input contract PIPELINE_CONTEXT
 * documents; EM's fields live in the richer CONTEXT_FIELDS registry. Every
 * subscore's inputs are FIXED — tuned by knobs, never by field selection. */
export type FixedSubscoreId = Exclude<SubscoreId, "em">;

// ── THE THREE LANES ────────────────────────────────────────────────────

export type LaneId = "organic" | "inorganic" | "hybrid";

export type Lane = {
  id: LaneId;
  label: string;
  /** The subscores this lane's score multiplies, in display order. */
  parts: readonly SubscoreId[];
  /** Which merit the lane rewards. */
  merit: string;
};

export const LANES: readonly Lane[] = [
  { id: "organic",   label: "Organic",   parts: ["em", "sm", "gp", "xx"],       merit: "earned — Google" },
  { id: "inorganic", label: "Inorganic", parts: ["em", "sm", "rp", "xx"],       merit: "bought — Rewards" },
  { id: "hybrid",    label: "Hybrid",    parts: ["em", "sm", "gp", "rp", "xx"], merit: "both" },
];

export const LANE_BY_ID = Object.fromEntries(LANES.map((l) => [l.id, l])) as Record<LaneId, Lane>;

/** The locked merge rotation — identical for Swipe and Map. */
export const MERGE_ROTATION: readonly LaneId[] = ["organic", "inorganic", "hybrid"];

/** A lane's formula in the model's shorthand — e.g. "EM·SM·GP·XX". */
export function laneFormula(lane: Lane): string {
  return lane.parts.map((p) => SUBSCORE_BY_ID[p].short).join("·");
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

/** One lane's score — the product of its subscores, each clamped to [0,1]. */
export function laneScore(lane: Lane, subs: Record<SubscoreId, number>): number {
  let s = 1;
  for (const p of lane.parts) s *= clamp01(subs[p]);
  return s;
}

// ── EM — Embeddings Match ──────────────────────────────────────────────
// The encoder is a FIXED DECISION, not a param (Pato 2026-07-16): OpenAI
// text-embedding-3-small at its NATIVE 1536 dims. Vectors are
// unit-normalized, so cos = A·B — pgvector computes it at recall; the
// playground emulates the encoder with a feature-hash stand-in at the same
// dims. Chose small over large: the MTEB gap is ~2 pts, not worth 2× vector
// size + ~6.5× cost; upgrade path (a cheap catalog re-embed) would be a NEW
// decision here, never a knob.

export const EM_ENCODER = {
  model: "text-embedding-3-small",
  dims: 1536,
} as const;

/** EM from a raw cosine — clamp negatives (opposite/unrelated → 0). Revisit
 * (percentile calibration) only if real cosines cluster too tight. */
export function emScore(cos: number): number {
  return clamp01(Math.max(0, cos));
}

// ── SM — Structured Match ──────────────────────────────────────────────
//
// ONE hyperparam per intent axis (Pato 2026-07-21, blob v11):
//   where → defaultTolKm (green consumer default; falloff DIST_EXP freezes)
//   when  → patience (one shape knob over a binary 2×24×7 openness array)
//   what  → tol (super = t, none = t²)
// That is EM's; Randomness is XX's green default only.

export type SmWhereParams = {
  /** Default distance tolerance, km — the CONSUMER DEFAULT (green): what
   * the where curve uses when the consumer's Where slider is unset. The
   * consumer's own tolerance always wins (SmInputs.tolKm). */
  defaultTolKm: number;
};

export type SmWhenParams = {
  /** Patience / shape ∈ [0,1]. 0 = only tolerant of open-now-for-a-while;
   * 1 = tolerant of places that open later and/or stay open only briefly. */
  patience: number;
};

export type SmWhatParams = {
  /** ONE tolerance t ∈ [0,1]: super-category rung = t, none rung = t².
   * Exact category (or mega listed) → 1; nothing asked → 1. */
  tol: number;
};

export type SmParams = {
  where: SmWhereParams;
  when: SmWhenParams;
  what: SmWhatParams;
};

// Frozen SM beliefs (out of the blob):
//   DIST_EXP            where falloff — was a knob; frozen at 3 (v11).
//   ZONE_SPILL_FRAC     named zone tolerance = 30% of the consumer's.
//   TIME_BLOCK_H        half-hour grid.
//   OPENNESS_*          when's binary horizon: 2 slots/h × 24 h × 7 d.
export const DIST_EXP = 3;
export const ZONE_SPILL_FRAC = 0.3;
/** The CODE default for sm.where.defaultTolKm. 5 km = car metros. */
export const DEFAULT_POINT_TOL_KM = 5;

/** Time resolves to half-hour blocks. */
export const TIME_BLOCK_H = 0.5;
export const OPENNESS_SLOTS_PER_HOUR = 2;
export const OPENNESS_HOURS = 24;
export const OPENNESS_DAYS = 7;
/** Full when horizon: 2 × 24 × 7 = 336 half-hour slots from the intent time. */
export const OPENNESS_SLOTS =
  OPENNESS_SLOTS_PER_HOUR * OPENNESS_HOURS * OPENNESS_DAYS;

export const DEFAULT_SM_PARAMS: SmParams = {
  where: { defaultTolKm: DEFAULT_POINT_TOL_KM },
  when: { patience: 0.35 },
  what: { tol: 0.5 },
};

/** Snap hours to the time grid. Everything time-shaped goes through this. */
export function quantizeH(hours: number, blockH: number = TIME_BLOCK_H): number {
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  if (blockH <= 0) return hours;
  return Math.round(hours / blockH) * blockH;
}

/**
 * where — distance decay from the consumer's W, 0–1. `tolKm` is per-mode:
 * the consumer's tolerance (DEFAULT_POINT_TOL_KM when unset) when W is a
 * point, its derived zone tolerance (× ZONE_SPILL_FRAC) when km measures
 * spillover past a named region's border (inside the region km = 0 → 1).
 * Unknown distance → 1 (a geo-less place is a data bug, not a scoring case).
 * Falloff is the frozen DIST_EXP.
 */
export function whereScore(km: number | null, tolKm: number): number {
  if (km == null) return 1;
  const tol = Math.max(0.5, tolKm); // NaN/zero guard — the range table's floor
  if (km <= 0) return 1;
  return 1 / (1 + Math.pow(km / tol, DIST_EXP));
}

/** First-open index + consecutive open run from a binary openness array. */
export function opennessStats(bits: readonly boolean[]): {
  opensInSlots: number | null;
  openRunSlots: number;
} {
  let opensIn: number | null = null;
  for (let i = 0; i < bits.length; i++) {
    if (bits[i]) {
      opensIn = i;
      break;
    }
  }
  if (opensIn == null) return { opensInSlots: null, openRunSlots: 0 };
  let run = 0;
  for (let i = opensIn; i < bits.length && bits[i]; i++) run++;
  return { opensInSlots: opensIn, openRunSlots: run };
}

/**
 * Synthesize a week-horizon openness bitstring from opens-in / open-for
 * (hours) — used by operator controls and plots that don't have a full
 * hours calendar. Real callers should prefer a hours→bits builder.
 */
export function synthesizeOpenness(opensInH: number, openForH: number): boolean[] {
  const bits = new Array<boolean>(OPENNESS_SLOTS).fill(false);
  const start = Math.max(0, Math.round(quantizeH(Math.max(0, opensInH)) / TIME_BLOCK_H));
  const run = Math.max(0, Math.round(quantizeH(Math.max(0, openForH)) / TIME_BLOCK_H));
  for (let i = 0; i < run && start + i < OPENNESS_SLOTS; i++) bits[start + i] = true;
  return bits;
}

export type WhenParts = {
  opensInSlots: number | null;
  openRunSlots: number;
  wait: number;
  fit: number;
  when: number;
};

/**
 * when — process the binary openness array with ONE patience knob.
 *   patience 0 → only tolerant of open-now-for-a-while (waitTol=0, need ~3 h)
 *   patience 1 → tolerant of future opens and short windows (waitTol=24 h, need 0.5 h)
 * Never-open in the horizon → 0. No hours data is the caller's job (→ when 1).
 */
export function whenParts(bits: readonly boolean[], patience: number): WhenParts {
  const p = clamp01(patience);
  const { opensInSlots, openRunSlots } = opennessStats(bits);
  if (opensInSlots == null) {
    return { opensInSlots: null, openRunSlots: 0, wait: 0, fit: 0, when: 0 };
  }
  // waitTol in slots: p=0 → 0 (must be open now); p=1 → 48 slots (24 h).
  const waitTol = p * 48;
  // needRun in slots: p=0 → 6 (3 h); p=1 → 1 (0.5 h).
  const needRun = 1 + (1 - p) * 5;
  const wait =
    opensInSlots === 0
      ? 1
      : waitTol <= 0
        ? 0
        : 1 / (1 + Math.pow(opensInSlots / waitTol, 4));
  const fit = Math.min(1, openRunSlots / needRun);
  return {
    opensInSlots,
    openRunSlots,
    wait: clamp01(wait),
    fit: clamp01(fit),
    when: clamp01(wait * fit),
  };
}

/** when as one number from openness bits + patience. */
export function whenFromOpenness(bits: readonly boolean[], patience: number): number {
  return whenParts(bits, patience).when;
}

/** Convenience: when from opens-in / open-for hours (synthesizes the array). */
export function whenScore(opensInH: number, openForH: number, p: SmWhenParams): number {
  return whenFromOpenness(synthesizeOpenness(opensInH, openForH), p.patience);
}

/** The category ladder's rungs — how the place's one category sits against
 * the intent's SET of categories and/or mega categories. */
export type WhatRelation = "exact" | "sibling" | "mismatch" | "none";

/** none rung = t² — derived from the single what tolerance. */
export function noneRung(tol: number): number {
  const t = clamp01(tol);
  return t * t;
}

export function whatScore(rel: WhatRelation, p: SmWhatParams): number {
  switch (rel) {
    case "exact":
      return 1;
    case "sibling":
      return clamp01(p.tol);
    case "mismatch":
      return noneRung(p.tol);
    case "none":
      return 1;
  }
}

export type SmInputs = {
  /** km to W (0 inside a named region) · null = unknown → where 1. */
  km: number | null;
  /** The consumer's distance tolerance (their Where filter slider), km ·
   * null = unset → the admin's defaultTolKm knob (the green consumer
   * default). Runtime input always wins over the default. */
  tolKm: number | null;
  /** True when W is a named region (zone mode) — picks the derived zone
   * tolerance (tolerance × ZONE_SPILL_FRAC). */
  zoneMode: boolean;
  /** Hours until the place opens at the intent time (0 = open now).
   * Used when `openness` is omitted — synthesizes the binary array. */
  opensInH: number;
  /** Hours it stays open from then. Used when `openness` is omitted. */
  openForH: number;
  /** Preferred: the binary 2×24×7 openness array starting at intent time. */
  openness?: readonly boolean[];
  /** True when the place has no usable hours (≠ closed) → when 1. */
  hoursUnknown: boolean;
  /** The category ladder's resolution for this intent × place. */
  whatRel: WhatRelation;
};

/** SM itemized — every factor the playground's ledger renders. */
export type SmParts = {
  tolKm: number;
  where: number;
  wait: number;
  fit: number;
  when: number;
  what: number;
  sm: number;
  opensInSlots: number | null;
  openRunSlots: number;
};

export function smParts(i: SmInputs, p: SmParams = DEFAULT_SM_PARAMS): SmParts {
  // The consumer owns the tolerance (unset → the admin's green default
  // knob); a named zone is a constraint, not a vibe — a fixed fraction.
  const baseTol = i.tolKm ?? p.where.defaultTolKm;
  const tolKm = i.zoneMode ? baseTol * ZONE_SPILL_FRAC : baseTol;
  const where = whereScore(i.km, tolKm);
  const wp = i.hoursUnknown
    ? {
        opensInSlots: null as number | null,
        openRunSlots: 0,
        wait: 1,
        fit: 1,
        when: 1,
      }
    : whenParts(i.openness ?? synthesizeOpenness(i.opensInH, i.openForH), p.when.patience);
  const what = whatScore(i.whatRel, p.what);
  return {
    tolKm,
    where,
    wait: wp.wait,
    fit: wp.fit,
    when: wp.when,
    what,
    sm: where * wp.when * what,
    opensInSlots: wp.opensInSlots,
    openRunSlots: wp.openRunSlots,
  };
}

/** SM as one number, 0–1. */
export function smScore(i: SmInputs, p: SmParams = DEFAULT_SM_PARAMS): number {
  return smParts(i, p).sm;
}

// ── GP — Google Popularity ─────────────────────────────────────────────

export type GpParams = {
  /** ln(1 + starMass) that reads as fully popular — GP 1. 10 → e¹⁰ ≈ 22,026
   * star mass (≈ 4.5★ × ~4,900 reviews); each ×e more adds 0.1. */
  lnCeiling: number;
  /** Exponent on the star average before × review count. Default 1 (linear);
   * max 2 — amplifies rating differences (4.8★ pulls away from 4.0★). */
  ratingPow: number;
};

export const DEFAULT_GP_PARAMS: GpParams = { lnCeiling: 10, ratingPow: 1 };

/** GP itemized — the ledger's rows. */
export type GpParts = {
  reviews: number;
  rating: number | null;
  /** r^ratingPow · n — weighted star mass. */
  raw: number;
  /** The subscore, 0–1. n = 0 → 0 (no Google presence = out of organic). */
  gp: number;
};

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
  const pow = Math.min(2, Math.max(1, p.ratingPow));
  const raw = r == null ? 0 : Math.pow(Math.max(0, r), pow) * n;
  const gp = clamp01(Math.log(1 + raw) / Math.max(1, p.lnCeiling));
  return { reviews: n, rating: r, raw, gp };
}

/** GP as one number, 0–1. */
export function gpScore(
  reviews: number | null | undefined,
  rating: number | null | undefined,
  p: GpParams = DEFAULT_GP_PARAMS,
): number {
  return gpParts(reviews, rating, p).gp;
}

// ── RP — Rewards Promotions ────────────────────────────────────────────
// Postures come from ./strategies (the four promo presets). The rung each
// posture earns is CONFIG (the blob's rp block). No literal 0: non-members
// never enter the paid lanes at all (lane filter); custom/legacy rates that
// match no preset land on the zero rung.

export type RpPosture = "zero" | "conservative" | "aggressive" | "dominant";

export type RpRungs = Record<RpPosture, number>;

export const DEFAULT_RP_RUNGS: RpRungs = {
  zero: 0.1,
  conservative: 0.4,
  aggressive: 0.7,
  dominant: 1.0,
};

/** RP for a posture (null = custom/legacy → the zero rung). */
export function rpScore(posture: RpPosture | null, rungs: RpRungs = DEFAULT_RP_RUNGS): number {
  return clamp01(rungs[posture ?? "zero"]);
}

// ── XX — Random Number ─────────────────────────────────────────────────

export type XxParams = {
  /** Deck-wide randomness, 0 (off — pure merit) … 5 (near-total chaos). */
  control: number;
};

export const DEFAULT_XX_PARAMS: XxParams = { control: 1 };

/** XX from a unit draw — U^control. control 0 → 1 for every card. */
export function xxScore(u: number, control: number): number {
  const c = Math.max(0, Math.min(5, control));
  return clamp01(Math.pow(clamp01(u), c));
}

// Deterministic unit draws for the playground — a seeded hash so the same
// (card, lane, roll) always lands the same U until the operator re-rolls.
function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** U ~ Uniform[0,1), stable per (place, lane, roll). */
export function unitDraw(placeId: string, laneId: LaneId, roll: number): number {
  return hash32(`${placeId}·${laneId}·${roll}`) / 4294967296;
}

// ── THE FINAL DECK — three lanes, round-robin, dedupe, no backfill ─────

/** Shared lane length N — every lane contributes up to N cards. */
/** Per-lane deck counts — how many cards each lane may contribute
 * (MESITA-659). 0 turns a lane off (e.g. no paid cards). */
export type LaneCounts = Record<LaneId, number>;

export const DEFAULT_LANE_COUNTS: LaneCounts = {
  organic: 8,
  inorganic: 8,
  hybrid: 8,
};
export const LANE_N_MAX = 50;

/** Ceiling of the merged deck at the given counts. */
export function laneCountsTotal(counts: LaneCounts): number {
  return counts.organic + counts.inorganic + counts.hybrid;
}

export type DeckSlot = {
  id: string;
  /** The lane whose card this is — its badge. */
  laneId: LaneId;
  /** That lane's score for this place. */
  score: number;
};

export type LaneFill = {
  /** Cards the lane put forward (min(eligible, N)). */
  taken: number;
  /** Candidates with score > 0 in this lane. */
  eligible: number;
  /** Cards that survived the dedupe into the final deck. */
  contributed: number;
  /** Cards dropped at merge — the place arrived earlier via another lane. */
  mergedAway: number;
};

export type FinalDeck = {
  /** Each lane's top-N as generated — including cards later merged away. */
  lanes: Record<LaneId, DeckSlot[]>;
  /** The merged deck, in rotation order. ≤ N_O + N_I + N_H. */
  slots: DeckSlot[];
  fills: Record<LaneId, LaneFill>;
};

/** One place's three lane scores. */
export type DeckCandidate = { id: string; scores: Record<LaneId, number> };

/**
 * The locked merge, per-lane counts (MESITA-659): each lane ranks the pool
 * by its own score (ties by id — deterministic), drops score ≤ 0, takes its
 * OWN top-N (a lane at 0 contributes nothing). Round-robin O → I → H one
 * card at a time, skipping lanes past their count; a place already in the
 * deck is SKIPPED (first occurrence wins — organic, since O leads the
 * rotation). NO backfill.
 */
export function composeFinalDeck(
  candidates: readonly DeckCandidate[],
  counts: LaneCounts,
): FinalDeck {
  const n = {} as Record<LaneId, number>;
  for (const lane of LANES) {
    n[lane.id] = Math.max(0, Math.min(LANE_N_MAX, Math.round(counts[lane.id] ?? 0)));
  }
  const lanes = {} as Record<LaneId, DeckSlot[]>;
  const fills = {} as Record<LaneId, LaneFill>;

  for (const lane of LANES) {
    const ranked = candidates
      .filter((c) => (c.scores[lane.id] ?? 0) > 0)
      .slice()
      .sort((a, b) => b.scores[lane.id] - a.scores[lane.id] || (a.id < b.id ? -1 : 1));
    lanes[lane.id] = ranked
      .slice(0, n[lane.id])
      .map((c) => ({ id: c.id, laneId: lane.id, score: c.scores[lane.id] }));
    fills[lane.id] = {
      taken: Math.min(ranked.length, n[lane.id]),
      eligible: ranked.length,
      contributed: 0,
      mergedAway: 0,
    };
  }

  const rounds = Math.max(n.organic, n.inorganic, n.hybrid);
  const seen = new Set<string>();
  const slots: DeckSlot[] = [];
  for (let i = 0; i < rounds; i++) {
    for (const laneId of MERGE_ROTATION) {
      const slot = lanes[laneId][i];
      if (!slot) continue;
      if (seen.has(slot.id)) {
        fills[laneId].mergedAway++;
        continue;
      }
      seen.add(slot.id);
      slots.push(slot);
      fills[laneId].contributed++;
    }
  }

  return { lanes, slots, fills };
}

// ── LINEUP — the one engine (named 2026-07-17) ─────────────────────────
// Lineup is the candidate-generation engine: consumer + intent → scored
// candidates → the deck. There is exactly ONE engine — the three lanes,
// Organic · Inorganic · Hybrid, merged O → I → H (dedupe on insert, no
// backfill). It has three CALLERS, not surfaces: Swipe and Map (the consumer
// hits Lineup directly from Home and the Map) and Memo (the RAG concierge
// calls Lineup as a TOOL, then reasons over what it returns). Callers differ
// only in where the intent-data comes from (prebuilt taste embedding · taste +
// viewport · synthesized from the question).

export const LINEUP_ENGINE = {
  name: "Lineup",
  composition: "Organic + Inorganic + Hybrid, merged O → I → H · dedupe on insert · no backfill",
  callers: [
    { caller: "Swipe", intent: "prebuilt taste embedding" },
    { caller: "Map",   intent: "taste embedding + viewport" },
    { caller: "Memo",  intent: "synthesized from the question — Lineup as a tool" },
  ],
} as const;

// NO RECALL CAP IN LINEUP (Pato 2026-07-21, REVERSING the 2026-07-17
// "recallTopK stays" decision): EM compares the query against ALL vectors —
// Lineup scores the whole catalog, filtered only by the consumer's METRO
// (city set — an identity fact, not a distance gate; the curve does all
// demotion within a metro). The deck is capped later by the per-lane counts.
// Retrieval-capping is MEMO's business (its own config at /memo-config) —
// and even Memo simply calls Lineup, takes the deck, and analyzes the cards.
// The old retrieval.recallTopK blob key is ignored on read.

// ── CONTEXT FIELD REGISTRY — EM's inputs, FIXED ─────────────────────────
// Every TEXT field EM reads, with a stable key. Inputs are NOT configurable
// (Pato 2026-07-21: "just mention the data fields — it's not configurable"),
// which retired v9's data-access matrix AND EM's per-field toggles in one
// stroke: each subscore's Inputs section is pure documentation of the fields
// it reads, the doc builders always assemble from every live field, and the
// blob carries no dataAccess/context keys (v10). "ignored" fields are the
// spec's "ignored for now" list — shown greyed, never embedded. Which
// SOURCES a subscore reads is structural and lives in the docs too: EM never
// sees interaction (two independently-built vectors, neither knows the
// pair); GP and RP read only the place; XX reads nothing but its own draw.

export type ContextSide = "consumer" | "intent" | "place";

export type ContextFieldDef = {
  /** Stable key, "side.name" — how the doc builders name the field. */
  key: string;
  side: ContextSide;
  label: string;
  /** "live" = data exists and the doc builders consume it · "planned" = in
   * the contract, no data yet · "ignored" = the spec's "ignored for now"
   * list — greyed, never toggleable, never embedded. */
  status: "live" | "planned" | "ignored";
  note?: string;
};

// The lists ARE the spec (Notion Scoring, data taxonomy, 2026-07-16):
//   Consumer → EM: sex · age · name · country · class+why. Ignored: taste ·
//     history. (IG-origin lives inside class+why, not as its own field.)
//   Intent → EM (text): that (the ask) · near-zone · time. Ignored: party ·
//     budget · day-of-week. (The NUMERIC where/when/what go to SM, never EM;
//     THAT — the fourth intent axis — is EM's, never SM's.)
//   Place → EM: name · category · tags · description · zone & city ·
//     reviews summary (G·IG·FB, planned) · price (planned). Rating & review
//     count are GP's; hours and lat/lng are SM's — ROUTED, so they are not
//     EM chips at all.
export const CONTEXT_FIELDS: readonly ContextFieldDef[] = [
  // Consumer.
  { key: "consumer.name",    side: "consumer", label: "name (first)",                status: "live", note: "cultural/cuisine priors — textualized, never the id" },
  { key: "consumer.sex",     side: "consumer", label: "sex",                         status: "live" },
  { key: "consumer.age",     side: "consumer", label: "age (from birthday, server-side)", status: "live" },
  { key: "consumer.country", side: "consumer", label: "country (inferred from phone)", status: "live" },
  { key: "consumer.class",   side: "consumer", label: "class + why (IG-invited vs subscribed)", status: "live" },
  { key: "consumer.taste",   side: "consumer", label: "taste tokens",                status: "ignored", note: "ignored for now (spec)" },
  { key: "consumer.history", side: "consumer", label: "history",                     status: "ignored", note: "ignored for now (spec)" },
  // Intent — the per-query half. Where/when appear as TEXT here by design;
  // their NUMERIC versions are SM's inputs, never EM's.
  { key: "intent.query",     side: "intent",   label: "that · the ask (free text)",  status: "live", note: "the intent's 4th axis — storage key stays intent.query for blob compat" },
  { key: "intent.zone",      side: "intent",   label: "near-zone (as text)",         status: "live" },
  { key: "intent.time",      side: "intent",   label: "day + time (as text)",        status: "live" },
  { key: "intent.party",     side: "intent",   label: "party size",                  status: "ignored", note: "ignored for now (spec) — a filter's job" },
  { key: "intent.budget",    side: "intent",   label: "budget",                      status: "ignored", note: "ignored for now (spec)" },
  { key: "intent.dow",       side: "intent",   label: "day-of-week",                 status: "ignored", note: "ignored for now (spec)" },
  // Place — the Enricher-built profile.
  { key: "place.name",        side: "place",   label: "name",                        status: "live", note: "info-dense — cuisine, format and register live in the string" },
  { key: "place.category",    side: "place",   label: "category",                    status: "live" },
  { key: "place.tags",        side: "place",   label: "tags",                        status: "live" },
  { key: "place.description", side: "place",   label: "description",                 status: "live" },
  { key: "place.zone_city",   side: "place",   label: "zone & city",                 status: "live" },
  { key: "place.reviews",     side: "place",   label: "reviews summary (Google · Instagram · Facebook)", status: "planned" },
  { key: "place.price",       side: "place",   label: "price",                       status: "planned" },
];

/** The fields EM actually embeds — every live key; display counts read this. */
export const LIVE_CONTEXT_COUNT: number = CONTEXT_FIELDS.filter(
  (f) => f.status === "live",
).length;

// ── Persisted settings (app_settings.scoring_config) ───────────────────
// The Subscores tab saves ONE versioned blob. NULL in the DB means
// "following code defaults" — default improvements propagate until someone
// saves an override. Reset-to-defaults loads these values into the form;
// Save writes the blob.
//
// RANGE TABLE (mirrored VERBATIM in admin-web-update-lineup-config).
// The encoder (EM_ENCODER — small @ 1536) is a FIXED constant, deliberately
// absent: fixed decisions never enter the blob.
//   laneN.{organic,inorganic,hybrid}  0–50 int each, sum ≥ 1 (0 = lane off;
//                                     legacy flat number expands to all three)
//   (retrieval.recallTopK is GONE — v9: Lineup scores the whole metro
//    catalog, no recall cap; a stray retrieval key is ignored)
//   sm.where.defaultTolKm 0.5–20 (GREEN — where's ONE param / consumer default)
//   sm.when.patience      0–1   (when's ONE shape knob over the openness array)
//   sm.what.tol           0–1   (what's ONE tol — super = t, none = t²)
//   (distExp · waitFloor · sessionH · sibling are GONE — v11; stray keys
//    ignored. DIST_EXP · ZONE_SPILL_FRAC · TIME_BLOCK_H · OPENNESS_* freeze)
//   gp.lnCeiling          5–15
//   gp.ratingPow          1–2   (0.1 steps; default 1)
//   rp.*                  0–1
//   xx.control            0–5   (GREEN default only — not a hyperparam)
//   (dataAccess + context are GONE — v10: inputs are FIXED documentation)

export type ScoringSettings = {
  v: 11;
  /** Per-lane deck counts (MESITA-659) — how many cards each lane may
   * contribute to the merged deck; 0 turns the lane off. */
  laneN: LaneCounts;
  sm: SmParams;
  gp: GpParams;
  rp: RpRungs;
  xx: XxParams;
};

export const DEFAULT_SCORING_SETTINGS: ScoringSettings = {
  v: 11,
  laneN: DEFAULT_LANE_COUNTS,
  sm: DEFAULT_SM_PARAMS,
  gp: DEFAULT_GP_PARAMS,
  rp: DEFAULT_RP_RUNGS,
  xx: DEFAULT_XX_PARAMS,
};

function num(v: unknown, fallback: number, lo: number, hi: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
}

// Per-lane counts (v5). A legacy flat number (v4 blobs) expands to all three
// lanes; per-key garbage falls back to that lane's default; an all-zero
// result (a config that would empty every deck) falls back to defaults —
// degenerate lanes are fine, a degenerate DECK is not.
function coerceLaneCounts(v: unknown, fallback: LaneCounts): LaneCounts {
  if (typeof v === "number" && Number.isFinite(v)) {
    const n = Math.round(Math.min(LANE_N_MAX, Math.max(0, v)));
    return { organic: n, inorganic: n, hybrid: n };
  }
  const raw = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const counts: LaneCounts = {
    organic: Math.round(num(raw.organic, fallback.organic, 0, LANE_N_MAX)),
    inorganic: Math.round(num(raw.inorganic, fallback.inorganic, 0, LANE_N_MAX)),
    hybrid: Math.round(num(raw.hybrid, fallback.hybrid, 0, LANE_N_MAX)),
  };
  return laneCountsTotal(counts) < 1 ? { ...fallback } : counts;
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

  // Note: stray `em`, `retrieval`, `dataAccess`/`context`, and pre-v11 SM
  // keys (`distExp` · `waitFloor` · `sessionH` · `sibling`) are dropped on
  // read — with soft migration for when/what below.
  const sm = (r.sm ?? {}) as Record<string, unknown>;
  const smWhere = (sm.where ?? {}) as Record<string, unknown>;
  const smWhen = (sm.when ?? {}) as Record<string, unknown>;
  const smWhat = (sm.what ?? {}) as Record<string, unknown>;
  const gp = (r.gp ?? {}) as Record<string, unknown>;
  const rp = (r.rp ?? {}) as Record<string, unknown>;
  const xx = (r.xx ?? {}) as Record<string, unknown>;

  // Soft-migrate v10 blobs: patience ← waitFloor; tol ← sibling.
  const patience = num(
    smWhen.patience ?? smWhen.waitFloor,
    d.sm.when.patience,
    0,
    1,
  );
  const whatTol = num(smWhat.tol ?? smWhat.sibling, d.sm.what.tol, 0, 1);

  return {
    v: 11,
    laneN: coerceLaneCounts(r.laneN, d.laneN),
    sm: {
      where: {
        defaultTolKm: num(smWhere.defaultTolKm, d.sm.where.defaultTolKm, 0.5, 20),
      },
      when: { patience },
      what: { tol: whatTol },
    },
    gp: {
      lnCeiling: num(gp.lnCeiling, d.gp.lnCeiling, 5, 15),
      ratingPow: num(gp.ratingPow, d.gp.ratingPow, 1, 2),
    },
    rp: {
      zero: num(rp.zero, d.rp.zero, 0, 1),
      conservative: num(rp.conservative, d.rp.conservative, 0, 1),
      aggressive: num(rp.aggressive, d.rp.aggressive, 0, 1),
      dominant: num(rp.dominant, d.rp.dominant, 0, 1),
    },
    xx: {
      control: num(xx.control, d.xx.control, 0, 5),
    },
  };
}

// ── PIPELINE CONTEXT — the fixed input contracts, per subscore ──────────
// EM's contract is CONTEXT_FIELDS above (same fixed nature, richer
// statuses); the other subscores document theirs here. All of it is
// DOCUMENTATION, never config. FOUR data sources — consumer · intent ·
// place · interaction (the consumer × place EDGE, which only SM can read:
// EM compares two independently-built vectors, neither of which knows the
// pair).

export type ContextField = {
  field: string;
  status: "live" | "planned" | "spec";
  note?: string;
};

export type SubscoreContext = {
  consumer: ContextField[];
  intent: ContextField[];
  place: ContextField[];
  interaction?: ContextField[];
};

export const PIPELINE_CONTEXT: Record<FixedSubscoreId, SubscoreContext> = {
  sm: {
    consumer: [{ field: "location lat/lng (GPS · last-used region fallback)", status: "live" }],
    intent: [
      { field: "zone / anchor set (→ W)", status: "live" },
      { field: "tolerated distance (slider, point mode)", status: "live" },
      { field: "target time → openness cursor (start of 2×24×7 array)", status: "live" },
      { field: "category set (categories · mega categories)", status: "live" },
    ],
    place: [
      { field: "lat/lng (NUMERIC)", status: "live" },
      { field: "zone (string, fuzzy-matched)", status: "live" },
      { field: "hours → binary openness array (2×24×7 half-hour blocks)", status: "live" },
      { field: "category", status: "live" },
    ],
    interaction: [
      { field: "visited · saved · rejected (per pair)", status: "planned", note: "the familiarity/novelty term — per-surface policy, not yet specced" },
    ],
  },
  gp: {
    consumer: [{ field: "—", status: "live" }],
    intent: [{ field: "—", status: "live" }],
    place: [
      { field: "google_review_count (NUMERIC)", status: "live" },
      { field: "google_stars_overall (NUMERIC)", status: "live" },
    ],
  },
  rp: {
    consumer: [{ field: "— (never; rates stay blended)", status: "live" }],
    intent: [{ field: "—", status: "live" }],
    place: [
      { field: "welcome/returning × free/premium rates (projects)", status: "live" },
    ],
  },
  xx: {
    consumer: [{ field: "—", status: "live" }],
    intent: [{ field: "—", status: "live" }],
    place: [{ field: "U ~ Uniform[0,1) per card per lane (seeded)", status: "live" }],
  },
};
