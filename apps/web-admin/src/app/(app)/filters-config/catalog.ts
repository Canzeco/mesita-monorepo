// Discovery catalog — the operator-facing mirror of the signal library.
//
// The vocabulary lives in code on the Edge Function side
// (`supabase/functions/_shared/discovery-signals.ts` SIGNAL_KEYS) and this file
// mirrors it, the same contract sourcing-config/catalog.ts keeps with
// channels.ts: the console edits NUMBERS, never the list of signals. Adding a
// signal is a code change in both packages — deliberately, because a signal
// nobody wrote has nothing to score.
//
// TWO BOXES, ONE PAGE (Pato, 2026-08-24: Signals · Engines. Forget Filters.):
//
//   SIGNALS   six functions. One table: Input · Process · Output · every
//             hyperparameter including the exponent. Promoting is not a row.
//   ENGINES   functions that call signals: Engine(signal(), …). Only a WIRED
//             engine gets a knob, and today that knob is Swipe's `ranked`.
//
// Slotting and operator filters still live on the blob so a whole-blob Save
// cannot reset them. They have no knobs on this page.

export const SIGNAL_KEYS = [
  "proximity",
  "timing",
  "category",
  "popularity",
  "semantic",
  "randomness",
] as const;

export type SignalKey = (typeof SIGNAL_KEYS)[number];

export type SignalParamBag = Record<string, number>;
export type SignalParams = Record<SignalKey, SignalParamBag>;

export type DiscoveryConfig = {
  weights: Record<SignalKey, number>;
  params: SignalParams;
  slotting: { enabled: boolean; everyNth: number };
  filters: DiscoveryFilters;
  engines: Record<WiredEngineKey, { ranked: boolean }>;
};

export type ParamField = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
};

export type DiscoveryFilters = {
  requireReady: boolean;
  minRating: number;
  minReviews: number;
  maxDistanceKm: number;
};

/** Mirrors WIRED_ENGINE_KEYS in _shared/discovery-config.ts. */
export const WIRED_ENGINE_KEYS = ["swipe"] as const;
export type WiredEngineKey = (typeof WIRED_ENGINE_KEYS)[number];

/** Mirrors WEIGHT_MIN / WEIGHT_MAX in _shared/discovery-config.ts. */
export const WEIGHT_MIN = 0;
export const WEIGHT_MAX = 4;
export const SLOT_MIN_EVERY_NTH = 2;
export const SLOT_MAX_EVERY_NTH = 50;
export const MIN_RATING_MAX = 5;
export const MAX_DISTANCE_KM_MAX = 200;

/** Mirrors DISCOVERY_DEFAULTS. Used only as the seed on a failed load. */
export const DEFAULT_SIGNAL_PARAMS: SignalParams = {
  proximity: { maxKm: 25, kneeKm: 1, missingGeo: 0.35 },
  timing: {
    openShare: 0.7,
    closedFloor: 0.2,
    dead: 0.25,
    dawn: 0.55,
    breakfast: 0.8,
    midday: 1,
    evening: 1,
    late: 0.5,
  },
  category: { exact: 1, family: 0.55, miss: 0.1 },
  popularity: { priorRating: 4.2, confidence: 60, floorRating: 3 },
  semantic: { unembedded: 0.4 },
  randomness: {},
};

export const DEFAULT_CONFIG: DiscoveryConfig = {
  weights: {
    proximity: 1,
    timing: 1,
    category: 1,
    popularity: 1,
    semantic: 1,
    randomness: 0.35,
  },
  params: DEFAULT_SIGNAL_PARAMS,
  slotting: { enabled: true, everyNth: 5 },
  filters: { requireReady: true, minRating: 0, minReviews: 0, maxDistanceKm: 0 },
  engines: { swipe: { ranked: true } },
};

/**
 * The engine registry — Docs › Discovery §B, mirrored for the console.
 *
 * `wired` is the only thing that decides whether a row gets a control. An
 * engine that does not read the signal library must not offer a toggle over
 * it: the house rule is that a page whose engine is unbuilt shows its state,
 * not knobs.
 */
export const ENGINES: {
  key: string;
  label: string;
  fn: string;
  input: string;
  process: string;
  output: string;
  state: "LIVE" | "PARKED" | "UNBUILT";
  wired: WiredEngineKey | null;
}[] = [
  {
    key: "swipe",
    label: "Swipe",
    fn: "swipe()",
    input: "Ready pool + guest geo.",
    process: "swipe(proximity(), timing(), category(), popularity(), semantic(), randomness()) then slot bought cards. Ranked off = pool order.",
    output: "Ordered Home deck.",
    state: "LIVE",
    wired: "swipe",
  },
  {
    key: "map",
    label: "Map",
    fn: "map()",
    input: "Ready pool + viewport + query.",
    process: "Admission predicates only. Not wired to the blend yet.",
    output: "Pins and catalog rail.",
    state: "LIVE",
    wired: null,
  },
  {
    key: "favorites",
    label: "Favorites",
    fn: "favorites()",
    input: "What this guest saved.",
    process: "No ranking question. Recency of the save.",
    output: "The saved list.",
    state: "LIVE",
    wired: null,
  },
  {
    key: "catalog",
    label: "Catalog",
    fn: "catalog()",
    input: "Ready pool.",
    process: "Parked. The page redirects; the pill is coming-soon.",
    output: "A grid, when unparked.",
    state: "PARKED",
    wired: null,
  },
  {
    key: "chat",
    label: "Chat",
    fn: "chat()",
    input: "The guest's utterance + catalog.",
    process: "Parked. Don Memo is the persona; ships dark.",
    output: "A recommended set, when unparked.",
    state: "PARKED",
    wired: null,
  },
  {
    key: "social",
    label: "Social",
    fn: "social()",
    input: "Check-ins, likes, rewards, stories.",
    process: "Parked. An engine only — there is no Social signal.",
    output: "A live feed, when unparked.",
    state: "PARKED",
    wired: null,
  },
  {
    key: "name",
    label: "Name",
    fn: "name()",
    input: "A string.",
    process: "Unbuilt. Entity resolution.",
    output: "The right place.",
    state: "UNBUILT",
    wired: null,
  },
  {
    key: "web",
    label: "Web",
    fn: "web()",
    input: "A query the catalog cannot answer.",
    process: "Unbuilt. Perplexity retrieval. Already called from Chat.",
    output: "Places the catalog lacks.",
    state: "UNBUILT",
    wired: null,
  },
];

/**
 * One row of the weights table.
 *
 * `reads` is what the signal actually looks at, so an operator can tell WHY a
 * weight is doing nothing — Semantic against an un-embedded catalog is not
 * broken, it is abstaining, and the enrichment queue's semantic `summary`
 * function is what fixes that.
 *
 * `engines` names where the exponent is felt TODAY. Swipe is the only engine
 * wired so far; saying so on the page is the difference between an enforced
 * config and a staged one pretending otherwise.
 */
const UNIT: ParamField[] = [];
const ZERO_ONE = (key: string, label: string): ParamField => ({
  key,
  label,
  min: 0,
  max: 1,
  step: 0.05,
});

export const SIGNALS: {
  key: SignalKey;
  label: string;
  fn: string;
  input: string;
  process: string;
  output: string;
  fields: ParamField[];
}[] = [
  {
    key: "proximity",
    label: "Proximity",
    fn: "proximity()",
    input: "Place geo × guest geo. No guest geo → abstains at 1.",
    process: "Haversine km, then 1 − log1p(km / knee) / log1p(max / knee).",
    output: "1 at the guest, 0 past maxKm. Unlocated place → missingGeo.",
    fields: [
      { key: "maxKm", label: "maxKm", min: 1, max: 200, step: 0.5 },
      { key: "kneeKm", label: "kneeKm", min: 0.1, max: 25, step: 0.1 },
      ZERO_ONE("missingGeo", "missingGeo"),
    ],
  },
  {
    key: "timing",
    label: "Timing",
    fn: "timing()",
    input: "Weekly hours × the place's local clock.",
    process: "openShare × openOrFloor + (1 − openShare) × daypart(hour).",
    output: "Closed is demoted to closedFloor, never hidden.",
    fields: [
      ZERO_ONE("openShare", "openShare"),
      ZERO_ONE("closedFloor", "closedFloor"),
      ZERO_ONE("dead", "daypart dead"),
      ZERO_ONE("dawn", "daypart dawn"),
      ZERO_ONE("breakfast", "daypart breakfast"),
      ZERO_ONE("midday", "daypart midday"),
      ZERO_ONE("evening", "daypart evening"),
      ZERO_ONE("late", "daypart late"),
    ],
  },
  {
    key: "category",
    label: "Category",
    fn: "category()",
    input: "Place category/family × guest categories. Swipe states none.",
    process: "exact hit, else family hit, else miss. No intent → abstain.",
    output: "One of exact / family / miss.",
    fields: [
      ZERO_ONE("exact", "exact"),
      ZERO_ONE("family", "family"),
      ZERO_ONE("miss", "miss"),
    ],
  },
  {
    key: "popularity",
    label: "Popularity",
    fn: "popularity()",
    input: "Google rating + review count.",
    process: "(v·r + m·prior) / (v + m), then stretch from floorRating to 5.",
    output: "Unrated place gets the prior, never an abstention.",
    fields: [
      { key: "priorRating", label: "priorRating", min: 0, max: 5, step: 0.1 },
      { key: "confidence", label: "confidence", min: 1, max: 1000, step: 1 },
      { key: "floorRating", label: "floorRating", min: 0, max: 4.9, step: 0.1 },
    ],
  },
  {
    key: "semantic",
    label: "Semantic",
    fn: "semantic()",
    input: "Query vector × places.embedding (Summary, never Presentation).",
    process: "(cosine + 1) / 2. No query → abstain.",
    output: "Unembedded place → unembedded, never deleted.",
    fields: [ZERO_ONE("unembedded", "unembedded")],
  },
  {
    key: "randomness",
    label: "Randomness",
    fn: "randomness()",
    input: "Nothing about the place. A uniform draw.",
    process: "rng() in [0, 1). The exponent is the only knob.",
    output: "A number that only breaks near-ties when the exponent is soft.",
    fields: UNIT,
  },
];

/** Which engines read these weights today. Swipe is the proof-of-enforcement. */
export const WIRED_ENGINES = ["Swipe"] as const;

function num(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Tolerant read of whatever the EF returned, rebuilt against SIGNAL_KEYS.
 *
 * Exponents round to two decimals for the same reason the EF normalizer does:
 * the field steps in 0.05, and a float landing at 1.7000000000000002 would
 * leave the page permanently `dirty` against its own saved value.
 */
export function coerceConfig(raw: unknown): DiscoveryConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const w = (r.weights ?? {}) as Record<string, unknown>;
  const s = (r.slotting ?? {}) as Record<string, unknown>;

  const weights = {} as Record<SignalKey, number>;
  for (const key of SIGNAL_KEYS) {
    const v = num(w[key], DEFAULT_CONFIG.weights[key], WEIGHT_MIN, WEIGHT_MAX);
    weights[key] = Math.round(v * 100) / 100;
  }

  const f = (r.filters ?? {}) as Record<string, unknown>;
  const e = (r.engines ?? {}) as Record<string, unknown>;

  const engines = {} as Record<WiredEngineKey, { ranked: boolean }>;
  for (const key of WIRED_ENGINE_KEYS) {
    const row = (e[key] ?? {}) as Record<string, unknown>;
    engines[key] = {
      ranked: typeof row.ranked === "boolean" ? row.ranked : DEFAULT_CONFIG.engines[key].ranked,
    };
  }

  const rawParams = (r.params ?? {}) as Record<string, unknown>;
  const params = {} as SignalParams;
  for (const key of SIGNAL_KEYS) {
    const bag = (rawParams[key] ?? {}) as Record<string, unknown>;
    const next: SignalParamBag = {};
    const spec = SIGNALS.find((s) => s.key === key);
    for (const field of spec?.fields ?? []) {
      const fallback = DEFAULT_SIGNAL_PARAMS[key][field.key];
      const v = num(bag[field.key], fallback, field.min, field.max);
      const decimals = field.step >= 1 ? 0 : field.step >= 0.5 ? 1 : 2;
      const factor = 10 ** decimals;
      next[field.key] = Math.round(v * factor) / factor;
    }
    params[key] = next;
  }

  return {
    weights,
    params,
    slotting: {
      enabled: typeof s.enabled === "boolean" ? s.enabled : DEFAULT_CONFIG.slotting.enabled,
      everyNth: Math.round(
        num(s.everyNth, DEFAULT_CONFIG.slotting.everyNth, SLOT_MIN_EVERY_NTH, SLOT_MAX_EVERY_NTH),
      ),
    },
    filters: {
      requireReady: typeof f.requireReady === "boolean"
        ? f.requireReady
        : DEFAULT_CONFIG.filters.requireReady,
      // One decimal: Google stars are one-decimal values, and a floor landing
      // at 4.300000000000001 would leave the page permanently dirty.
      minRating: Math.round(
        num(f.minRating, DEFAULT_CONFIG.filters.minRating, 0, MIN_RATING_MAX) * 10,
      ) / 10,
      minReviews: Math.round(num(f.minReviews, DEFAULT_CONFIG.filters.minReviews, 0, 100_000)),
      maxDistanceKm: Math.round(
        num(f.maxDistanceKm, DEFAULT_CONFIG.filters.maxDistanceKm, 0, MAX_DISTANCE_KM_MAX),
      ),
    },
    engines,
  };
}

/**
 * How an exponent reads in words. The table shows this beside every row,
 * because "1.6" means nothing on its own and the whole model is the ratio
 * between rows.
 */
export function weightMeaning(w: number): string {
  if (w <= 0) return "Off — drops out of the blend";
  if (w < 0.75) return "Soft — only breaks near-ties";
  if (w < 1.25) return "Normal — the signal's own number";
  if (w < 2.5) return "Sharp — near-misses fall away";
  return "Harsh — only near-perfect survives";
}
