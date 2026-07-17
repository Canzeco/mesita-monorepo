// Recommendation Scores v10 — the model behind Swipe · Map · Memo.
// Master spec: Notion 🥇 Scoring (2026-07-16, eng-reviewed same day).
//
// FIVE SUBSCORES → THREE LANES → ONE FINAL DECK.
//
//   EM  Embeddings Match     [0,1]  cosine(place vector, consumer+intent
//                                   vector), clamped max(0, cos). Encoder:
//                                   OpenAI text-embedding-3-small @ 1536
//                                   (emulated feature-hash in the playground).
//   SM  Structured Match     [0,1]  where × when × what — deterministic
//                                   checks of the intent's structured asks
//                                   against place facts. (Renamed from
//                                   "Natural Match": "natural" implies
//                                   natural language, which is EM's job.)
//   GP  Google Popularity    [0,1]  min(1, ln(1 + r·n) / lnCeiling) — total
//                                   star mass, log-squashed. A simple log,
//                                   NOT a sigmoid: a sigmoid needs a "typical
//                                   popularity" center (a fitted-looking
//                                   scale assumption); the log needs one
//                                   ceiling knob. e¹⁰ ≈ 22,026 star-mass = 1.
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
// MERGE (locked 2026-07-16): the three lanes each rank the pool by their own
// score and take their top-N (laneN, shared). Round-robin O → I → H —
// identical for Swipe and Map — dedupe ON INSERT (keep the FIRST occurrence,
// drop later duplicates), NO backfill: the final deck is ≤ 3·N and shrinks
// as lanes agree. Shrinkage is signal, not defect.
//
// ENGINES ARE CONTAINERS, not formulas: Swipe and Map compose the three
// lanes exactly as above and differ only in intent source (taste embedding;
// + viewport). Memo is free/dynamic — indexes + RAG, decomposing the five
// subscores however the question needs.
//
// ── SM = where × when × what ───────────────────────────────────────────
//   where = 1 / (1 + (km / tolerance)³)
//     km measured to the consumer's W: a REGION SET if zones/anchors were
//     named (inside any → 0; outside → distance from the nearest border),
//     else a POINT at GPS. Tolerance is PER-MODE: point 5 km (car-city
//     Friday span survives) · zone-spillover 1.5 km (a typed zone is a
//     constraint, not a vibe). k = 3: doubling distance beyond tolerance
//     costs 8× — distance is the app's most important param; the tail is
//     honestly a soft gate. Zones registry / metro sets are the backend
//     build (MESITA-644 review, D2–D11); the playground emulates W as the
//     anchor point + zone string match.
//   when = wait × fit, times snapped to the 30-min grid first.
//     wait = floor + (1 − floor) / (1 + (opensIn / h)⁴) — TWO PLATEAUS,
//     thin middle: ≈1 open-now-ish, floor if not, never 0 (the weekend-only
//     gem browsed on a Monday keeps 0.3). h = 2: browsing at 21:00 for a
//     club that opens at 23:00 → 0.65, not buried.
//     fit = min(1, openFor / session) — sufficiency, not decay.
//   what — the category ladder over the intent's SET of categories and/or
//     mega categories: listed (or mega listed) → 1 · shares a mega category
//     with a listed category → 0.6 · no overlap → 0.2 (never 0 — SM gets no
//     veto over semantics) · nothing asked → 1.
//
// EVERY KNOB IS A BELIEF, NOT AN ESTIMATE — nothing here is fitted. Judge a
// change by its break-even, never by how far apart numbers land. Tune here;
// the Scoring Config page and the per-place Scores tab derive from this
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

/** EM — the one field-configurable subscore (its context is CONFIG). */
export type ConfigurableSubscoreId = Extract<SubscoreId, "em">;

/** SM · GP · RP · XX — inputs are structural (the numeric fields ARE the
 * function), so these are tuned by knobs, never by field selection. */
export type FixedSubscoreId = Exclude<SubscoreId, ConfigurableSubscoreId>;

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

export type SmWhereParams = {
  /** Point mode — km at which pull halves. The consumer slider. */
  pointTolKm: number;
  /** Zone mode — spillover km past a named region's border. Admin-only. */
  zoneSpillKm: number;
  /** Distance exponent. 3 = doubling distance beyond tolerance costs 8×. */
  distExp: number;
};

export type SmWhenParams = {
  /** The "not open now" plateau — a closed-today place never drops below this. */
  waitFloor: number;
  /** Hours-until-open where the two plateaus cross (wait = ~0.65). */
  waitTransitionH: number;
  /** Transition steepness — 4 = two plateaus, thin middle. */
  waitSteep: number;
  /** Hours the visit needs. Category-shaped later (coffee 0.5 · club 2.5). */
  sessionH: number;
  /** Time-grid resolution, hours. 0.5 = 30-min blocks. */
  timeBlockH: number;
};

export type SmWhatParams = {
  /** Shares a mega category with a listed category. */
  sibling: number;
  /** No overlap at all — floored above 0: SM gets no veto over semantics. */
  mismatch: number;
};

export type SmParams = {
  where: SmWhereParams;
  when: SmWhenParams;
  what: SmWhatParams;
};

// Defaults, argued from what Mesita IS (car metros, dinner-anchored,
// nightlife-heavy — see the header):
export const DEFAULT_SM_PARAMS: SmParams = {
  where: { pointTolKm: 5, zoneSpillKm: 1.5, distExp: 3 },
  when: { waitFloor: 0.3, waitTransitionH: 2, waitSteep: 4, sessionH: 1.5, timeBlockH: 0.5 },
  what: { sibling: 0.6, mismatch: 0.2 },
};

/** Time resolves to half-hour blocks. */
export const TIME_BLOCK_H = 0.5;

/** Snap hours to the time grid. Everything time-shaped goes through this. */
export function quantizeH(hours: number, blockH: number = TIME_BLOCK_H): number {
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  if (blockH <= 0) return hours;
  return Math.round(hours / blockH) * blockH;
}

/**
 * where — distance decay from the consumer's W, 0–1. `tolKm` is per-mode:
 * pointTolKm when W is a point, zoneSpillKm when km measures spillover past
 * a named region's border (inside the region km = 0 → 1). Unknown distance
 * → 1 (a geo-less place is a data bug to flag, not a scoring case).
 */
export function whereScore(km: number | null, tolKm: number, distExp: number): number {
  if (km == null) return 1;
  const tol = Math.max(0.5, tolKm); // NaN/zero guard — the range table's floor
  if (km <= 0) return 1;
  return 1 / (1 + Math.pow(km / tol, distExp));
}

/** wait — two plateaus: ≈1 open-now-ish, the floor if not, never 0. */
export function waitScore(opensInH: number, p: SmWhenParams): number {
  const q = quantizeH(opensInH, p.timeBlockH);
  if (q <= 0) return 1;
  const f = clamp01(p.waitFloor);
  return f + (1 - f) / (1 + Math.pow(q / Math.max(0.5, p.waitTransitionH), p.waitSteep));
}

/** fit — is there time to complete the visit, 0–1. Caps at 1: enough is enough. */
export function fitScore(openForH: number, p: SmWhenParams): number {
  if (p.sessionH <= 0) return 1;
  return clamp01(quantizeH(openForH, p.timeBlockH) / p.sessionH);
}

/** when — wait × fit, 0–1. No hours data → the caller passes unknown and uses 1. */
export function whenScore(opensInH: number, openForH: number, p: SmWhenParams): number {
  return waitScore(opensInH, p) * fitScore(openForH, p);
}

/** The category ladder's rungs — how the place's one category sits against
 * the intent's SET of categories and/or mega categories. */
export type WhatRelation = "exact" | "sibling" | "mismatch" | "none";

export function whatScore(rel: WhatRelation, p: SmWhatParams): number {
  switch (rel) {
    case "exact":
      return 1;
    case "sibling":
      return clamp01(p.sibling);
    case "mismatch":
      return clamp01(p.mismatch);
    case "none":
      return 1;
  }
}

export type SmInputs = {
  /** km to W (0 inside a named region) · null = unknown → where 1. */
  km: number | null;
  /** True when W is a named region (zone mode) — picks zoneSpillKm. */
  zoneMode: boolean;
  /** Hours until the place opens at the intent time (0 = open now). */
  opensInH: number;
  /** Hours it stays open from then. */
  openForH: number;
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
};

export function smParts(i: SmInputs, p: SmParams = DEFAULT_SM_PARAMS): SmParts {
  const tolKm = i.zoneMode ? p.where.zoneSpillKm : p.where.pointTolKm;
  const where = whereScore(i.km, tolKm, p.where.distExp);
  const wait = i.hoursUnknown ? 1 : waitScore(i.opensInH, p.when);
  const fit = i.hoursUnknown ? 1 : fitScore(i.openForH, p.when);
  const when = wait * fit;
  const what = whatScore(i.whatRel, p.what);
  return { tolKm, where, wait, fit, when, what, sm: where * when * what };
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
};

export const DEFAULT_GP_PARAMS: GpParams = { lnCeiling: 10 };

/** GP itemized — the ledger's rows. */
export type GpParts = {
  reviews: number;
  rating: number | null;
  /** rating × reviews — total star mass. */
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
  const raw = r == null ? 0 : r * n;
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
export const DEFAULT_LANE_N = 8;
export const LANE_N_MAX = 20;

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
  /** The merged deck, in rotation order. ≤ 3·N. */
  slots: DeckSlot[];
  fills: Record<LaneId, LaneFill>;
};

/** One place's three lane scores. */
export type DeckCandidate = { id: string; scores: Record<LaneId, number> };

/**
 * The locked merge: each lane ranks the pool by its own score (ties by id —
 * deterministic), drops score ≤ 0, takes its top-N. Round-robin O → I → H
 * one card at a time; a place already in the deck is SKIPPED (first
 * occurrence wins — organic, since O leads the rotation). NO backfill.
 */
export function composeFinalDeck(candidates: readonly DeckCandidate[], laneN: number): FinalDeck {
  const N = Math.max(0, Math.min(LANE_N_MAX, Math.round(laneN)));
  const lanes = {} as Record<LaneId, DeckSlot[]>;
  const fills = {} as Record<LaneId, LaneFill>;

  for (const lane of LANES) {
    const ranked = candidates
      .filter((c) => (c.scores[lane.id] ?? 0) > 0)
      .slice()
      .sort((a, b) => b.scores[lane.id] - a.scores[lane.id] || (a.id < b.id ? -1 : 1));
    lanes[lane.id] = ranked
      .slice(0, N)
      .map((c) => ({ id: c.id, laneId: lane.id, score: c.scores[lane.id] }));
    fills[lane.id] = {
      taken: Math.min(ranked.length, N),
      eligible: ranked.length,
      contributed: 0,
      mergedAway: 0,
    };
  }

  const seen = new Set<string>();
  const slots: DeckSlot[] = [];
  for (let i = 0; i < N; i++) {
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

// ── THE STANDARD ENGINE — the one engine (decision 2026-07-16) ─────────
// There is exactly ONE engine. It consists of the three lanes — Organic ·
// Inorganic · Hybrid — merged O → I → H (dedupe on insert, no backfill).
// Swipe, Map and Memo are SURFACES, not engines: each runs the Standard
// Engine and differs only in where its intent-data comes from (prebuilt
// taste embedding · taste + viewport · synthesized from the question).

export const STANDARD_ENGINE = {
  name: "Standard Engine",
  composition: "Organic + Inorganic + Hybrid, merged O → I → H · dedupe on insert · no backfill",
  surfaces: [
    { surface: "Swipe", intent: "prebuilt taste embedding" },
    { surface: "Map",   intent: "taste embedding + viewport" },
    { surface: "Memo",  intent: "synthesized from the question, per query" },
  ],
} as const;

/**
 * Retrieval knob — how wide EM recall casts. Recall is filtered by the
 * consumer's METRO (city set — an identity fact, not a distance gate; the
 * curve does all demotion within a metro). Revisit with a wide bounding-box
 * prefilter only if catalog-per-metro passes ~400.
 */
export const DEFAULT_RETRIEVAL = {
  /** How many places pgvector recall returns for scoring. */
  recallTopK: 50,
};

// ── DATA-ACCESS CONFIGURATION — the core config ─────────────────────────
// (Notion Scoring spec: "Each subscore can be configured to select which
// data it is allowed to access. The default is all data ON; any individual
// data source can be toggled OFF per subscore. This is the main knob of the
// Subscores page.")
//
// FOUR data sources. Each subscore has an APPLICABLE subset (a source a
// subscore structurally cannot read isn't a toggle — it's a "—"): EM can
// never see interaction (it compares two independently-built vectors,
// neither of which knows the pair); GP and RP read only the place; XX reads
// nothing but its own draw.

export type DataSourceId = "consumer" | "place" | "intent" | "interaction";

export type DataSourceDef = {
  id: DataSourceId;
  label: string;
  blurb: string;
};

export const DATA_SOURCES: readonly DataSourceDef[] = [
  { id: "consumer",    label: "Consumer",    blurb: "per consumer — constant" },
  { id: "place",       label: "Place",       blurb: "per place — constant" },
  { id: "intent",      label: "Intent",      blurb: "per query — Where · When · What" },
  { id: "interaction", label: "Interaction", blurb: "per consumer × place — the edge" },
];

/** Which sources each subscore CAN read — the matrix's toggleable cells. */
export const APPLICABLE_SOURCES: Record<SubscoreId, readonly DataSourceId[]> = {
  em: ["consumer", "place", "intent"],
  sm: ["place", "intent", "interaction"],
  gp: ["place"],
  rp: ["place"],
  xx: [],
};

/** The saved matrix — per subscore, which applicable sources are ON. */
export type DataAccess = Record<SubscoreId, DataSourceId[]>;

// Default: ALL data ON (the spec's default) — every applicable cell enabled.
export const DEFAULT_DATA_ACCESS: DataAccess = Object.fromEntries(
  SUBSCORES.map((s) => [s.id, [...APPLICABLE_SOURCES[s.id]]]),
) as DataAccess;

// ── CONTEXT FIELD REGISTRY — EM's per-field detail ──────────────────────
// Every TEXT field EM could read, with a stable key. Which of these EM
// actually receives is CONFIG (ContextConfig, persisted in the blob): the
// admin toggles fields and the playground assembles its documents from
// exactly the enabled set — a toggle visibly changes the embedding, the
// cosine, and the ranking. "ignored" fields are the spec's "ignored for
// now" list — shown greyed, never toggleable, never embedded. SM/GP/RP/XX
// are the FixedSubscoreIds — not field-configurable; their knobs live above.

export type ContextSide = "consumer" | "intent" | "place";

export type ContextFieldDef = {
  /** Stable key, "side.name" — what ContextConfig stores. */
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
//   Intent → EM (text): query · near-zone · time. Ignored: party · budget ·
//     day-of-week. (The NUMERIC where/when/what go to SM, never EM.)
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
  { key: "intent.query",     side: "intent",   label: "what / occasion (question text)", status: "live" },
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

export const CONTEXT_KEYS: ReadonlySet<string> = new Set(CONTEXT_FIELDS.map((f) => f.key));

/** Keys an operator may actually toggle — "ignored" is out of bounds. */
export const TOGGLEABLE_CONTEXT_KEYS: ReadonlySet<string> = new Set(
  CONTEXT_FIELDS.filter((f) => f.status !== "ignored").map((f) => f.key),
);

/** Which fields EM reads — the configurable half of the pipeline. */
export type ContextConfig = Record<ConfigurableSubscoreId, string[]>;

// Arrays kept SORTED — the canonical order everywhere (form state sorts
// too), so key order can never fake an unsaved-changes diff. Default = all
// LIVE fields on (planned contribute nothing until data exists; ignored are
// not selectable at all).
export const DEFAULT_CONTEXT_CONFIG: ContextConfig = {
  em: CONTEXT_FIELDS.filter((f) => f.status === "live").map((f) => f.key).sort(),
};

// ── Persisted settings (app_settings.scoring_config) ───────────────────
// The Subscores tab saves ONE versioned blob. NULL in the DB means
// "following code defaults" — default improvements propagate until someone
// saves an override. Reset-to-defaults loads these values into the form;
// Save writes the blob.
//
// RANGE TABLE (mirrored VERBATIM in admin-web-update-scoring-config).
// The encoder (EM_ENCODER — small @ 1536) is a FIXED constant, deliberately
// absent: fixed decisions never enter the blob.
//   laneN                 1–20 int      retrieval.recallTopK   10–200
//   sm.where.pointTolKm   0.5–20        sm.where.zoneSpillKm   0.5–10
//   sm.where.distExp      1–5
//   sm.when.waitFloor     0–1           sm.when.waitTransitionH 0.5–6
//   sm.when.waitSteep     1–8           sm.when.sessionH       0.5–4
//   sm.when.timeBlockH    0.25–1
//   sm.what.sibling       0–1           sm.what.mismatch       0–1
//   gp.lnCeiling          5–15
//   rp.*                  0–1
//   xx.control            0–5
//   dataAccess.<subscore> ⊂ APPLICABLE_SOURCES (structural, per subscore)

export type ScoringSettings = {
  v: 4;
  laneN: number;
  retrieval: { recallTopK: number };
  sm: SmParams;
  gp: GpParams;
  rp: RpRungs;
  xx: XxParams;
  /** The core config — per-subscore source toggles. */
  dataAccess: DataAccess;
  context: ContextConfig;
};

export const DEFAULT_SCORING_SETTINGS: ScoringSettings = {
  v: 4,
  laneN: DEFAULT_LANE_N,
  retrieval: DEFAULT_RETRIEVAL,
  sm: DEFAULT_SM_PARAMS,
  gp: DEFAULT_GP_PARAMS,
  rp: DEFAULT_RP_RUNGS,
  xx: DEFAULT_XX_PARAMS,
  dataAccess: DEFAULT_DATA_ACCESS,
  context: DEFAULT_CONTEXT_CONFIG,
};

// Sorted + deduped so key order can never fake a settings diff. An empty
// array is a VALID (degenerate) config — everything off; only a non-array
// falls back to defaults. Only TOGGLEABLE keys survive — "ignored" fields
// can never enter the blob.
function coerceContextKeys(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return [...fallback].sort();
  return [
    ...new Set(
      v.filter((k): k is string => typeof k === "string" && TOGGLEABLE_CONTEXT_KEYS.has(k)),
    ),
  ].sort();
}

// Per-subscore source list — unknown/inapplicable sources dropped, sorted.
// A missing/non-array cell falls back to the default (all applicable ON);
// an empty array is VALID (that subscore reads nothing — degenerate on
// purpose, visible in the playgrounds).
function coerceDataAccess(v: unknown, fallback: DataAccess): DataAccess {
  const raw = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return Object.fromEntries(
    SUBSCORES.map((s) => {
      const cell = raw[s.id];
      const applicable = APPLICABLE_SOURCES[s.id];
      if (!Array.isArray(cell)) return [s.id, [...fallback[s.id]].sort()];
      const clean = [
        ...new Set(
          cell.filter(
            (x): x is DataSourceId =>
              typeof x === "string" && (applicable as readonly string[]).includes(x),
          ),
        ),
      ].sort();
      return [s.id, clean];
    }),
  ) as DataAccess;
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

  const ret = (r.retrieval ?? {}) as Record<string, unknown>;
  // Note: a stray `em` key from an older blob is silently dropped — the
  // encoder is EM_ENCODER, a fixed constant, never config.
  const sm = (r.sm ?? {}) as Record<string, unknown>;
  const smWhere = (sm.where ?? {}) as Record<string, unknown>;
  const smWhen = (sm.when ?? {}) as Record<string, unknown>;
  const smWhat = (sm.what ?? {}) as Record<string, unknown>;
  const gp = (r.gp ?? {}) as Record<string, unknown>;
  const rp = (r.rp ?? {}) as Record<string, unknown>;
  const xx = (r.xx ?? {}) as Record<string, unknown>;
  const ctx = (r.context ?? {}) as Record<string, unknown>;

  return {
    v: 4,
    laneN: Math.round(num(r.laneN, d.laneN, 1, LANE_N_MAX)),
    retrieval: {
      recallTopK: num(ret.recallTopK, d.retrieval.recallTopK, 10, 200),
    },
    sm: {
      where: {
        pointTolKm: num(smWhere.pointTolKm, d.sm.where.pointTolKm, 0.5, 20),
        zoneSpillKm: num(smWhere.zoneSpillKm, d.sm.where.zoneSpillKm, 0.5, 10),
        distExp: num(smWhere.distExp, d.sm.where.distExp, 1, 5),
      },
      when: {
        waitFloor: num(smWhen.waitFloor, d.sm.when.waitFloor, 0, 1),
        waitTransitionH: num(smWhen.waitTransitionH, d.sm.when.waitTransitionH, 0.5, 6),
        waitSteep: num(smWhen.waitSteep, d.sm.when.waitSteep, 1, 8),
        sessionH: num(smWhen.sessionH, d.sm.when.sessionH, 0.5, 4),
        timeBlockH: num(smWhen.timeBlockH, d.sm.when.timeBlockH, 0.25, 1),
      },
      what: {
        sibling: num(smWhat.sibling, d.sm.what.sibling, 0, 1),
        mismatch: num(smWhat.mismatch, d.sm.what.mismatch, 0, 1),
      },
    },
    gp: {
      lnCeiling: num(gp.lnCeiling, d.gp.lnCeiling, 5, 15),
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
    dataAccess: coerceDataAccess(r.dataAccess, d.dataAccess),
    context: {
      em: coerceContextKeys(ctx.em, d.context.em),
    },
  };
}

// ── PIPELINE CONTEXT — the FIXED data-access contracts ─────────────────
// EM's contract is CONFIG (CONTEXT_FIELDS + ContextConfig above). The fixed
// subscores keep fixed contracts: their inputs are structural. FOUR data
// sources — consumer · intent · place · interaction (the consumer × place
// EDGE, which only SM can read: EM compares two independently-built vectors,
// neither of which knows the pair).

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
      { field: "target time (NUMERIC)", status: "live" },
      { field: "category set (categories · mega categories)", status: "live" },
    ],
    place: [
      { field: "lat/lng (NUMERIC)", status: "live" },
      { field: "zone (string, fuzzy-matched)", status: "live" },
      { field: "hours → open windows (NUMERIC)", status: "live" },
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
      { field: "→ ln(1 + r·n) / ceiling", status: "live" },
    ],
  },
  rp: {
    consumer: [{ field: "— (never; rates stay blended)", status: "live" }],
    intent: [{ field: "—", status: "live" }],
    place: [
      { field: "welcome/returning × free/premium rates (projects)", status: "live" },
      { field: "→ posture → rung 0.1–1.0", status: "live" },
    ],
  },
  xx: {
    consumer: [{ field: "—", status: "live" }],
    intent: [{ field: "—", status: "live" }],
    place: [{ field: "U ~ Uniform[0,1) per card per lane (seeded)", status: "live" }],
  },
};
