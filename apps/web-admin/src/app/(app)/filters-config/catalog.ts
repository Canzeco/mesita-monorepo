// Discovery catalog — the operator-facing mirror of the signal library.
//
// The vocabulary lives in code on the Edge Function side
// (`supabase/functions/_shared/discovery-signals.ts` SIGNAL_KEYS) and this file
// mirrors it, the same contract sourcing-config/catalog.ts keeps with
// channels.ts: the console edits NUMBERS, never the list of signals. Adding a
// signal is a code change in both packages — deliberately, because a signal
// nobody wrote has nothing to score.
//
// Live HTML: Catalog · Social (staged) · Chat prompt. Signals · Engines Soon.
//
//   CATALOG   seedCount · generatedCount · placesPerRail · minSeedPlaces.
//             Enforced by consumer-web-list-catalog.
//   SOCIAL    seedCount · generatedCount · eventsPerRail · minSeedEvents ·
//             horizonDays. Staged — no Social/events engine yet.
//   CHAT      system prompt. Blank = in-code Memo persona.
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
  catalog: CatalogConfig;
  social: SocialConfig;
  chat: { prompt: string };
};

export type CatalogConfig = {
  seedCount: number;
  generatedCount: number;
  placesPerRail: number;
  minSeedPlaces: number;
};

export type SocialConfig = {
  seedCount: number;
  generatedCount: number;
  eventsPerRail: number;
  minSeedEvents: number;
  horizonDays: number;
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
export const CATALOG_COUNT_MAX = 20;
export const CATALOG_PLACES_PER_RAIL_MIN = 4;
export const CATALOG_PLACES_PER_RAIL_MAX = 20;
export const CATALOG_MIN_SEED_PLACES_MAX = 20;
export const SOCIAL_COUNT_MAX = 20;
export const SOCIAL_EVENTS_PER_RAIL_MIN = 4;
export const SOCIAL_EVENTS_PER_RAIL_MAX = 20;
export const SOCIAL_MIN_SEED_EVENTS_MAX = 20;
export const SOCIAL_HORIZON_DAYS_MIN = 1;
export const SOCIAL_HORIZON_DAYS_MAX = 90;
/** Mirrors CHAT_PROMPT_MAX in _shared/discovery-config.ts. */
export const CHAT_PROMPT_MAX = 12_000;

export const DEFAULT_CATALOG: CatalogConfig = {
  seedCount: 8,
  generatedCount: 8,
  placesPerRail: 8,
  minSeedPlaces: 2,
};

export const DEFAULT_SOCIAL: SocialConfig = {
  seedCount: 6,
  generatedCount: 6,
  eventsPerRail: 8,
  minSeedEvents: 1,
  horizonDays: 14,
};

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
  catalog: DEFAULT_CATALOG,
  social: DEFAULT_SOCIAL,
  chat: { prompt: "" },
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
  /** Vendor APIs this function calls when it runs. Empty = none. */
  apis: string[];
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
    apis: [],
  },
  {
    key: "map",
    label: "Map",
    fn: "map()",
    input: "Ready pool + guest pin / Monterrey.",
    process: "Nearest 50 by distance: listed Mesita ∪ Google Nearby Search when the web client opts in. Google-only rows are yellow stubs. Over quota skips Google, not the catalog. Pins and rail are the same set. Country chip does not cut pins.",
    output: "Pins and catalog rail.",
    state: "LIVE",
    wired: null,
    apis: ["Google Places Nearby Search"],
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
    apis: [],
  },
  {
    key: "catalog",
    label: "Catalog",
    fn: "catalog()",
    input: "Ready pool.",
    process: "Random Atlas seed rails plus vibe-query rails. Mesita embedding search per query; ILIKE if embed fails. No Google.",
    output: "Stacked catalog rails.",
    state: "LIVE",
    wired: null,
    apis: [],
  },
  {
    key: "chat",
    label: "Chat",
    fn: "chat()",
    input: "The guest's utterance plus the thread the client resends.",
    process: "OpenAI chat completions. System prompt from Discovery. No tools this pass.",
    output: "A conversational reply.",
    state: "LIVE",
    wired: null,
    apis: ["OpenAI"],
  },
  {
    key: "social",
    label: "Social",
    fn: "social()",
    input: "Upcoming events at listed places (happenings, not venues).",
    process: "Parked. Staged Discovery knobs persist; no events engine yet. Will query events, not places.",
    output: "Event rails on Home › Social, when unparked.",
    state: "PARKED",
    wired: null,
    apis: [],
  },
  {
    key: "name",
    label: "Name",
    fn: "name()",
    input: "A string + optional country + guest pin.",
    process: "Autocomplete while typing; one Text Search on idle; merge by Place ID. Details after a pick.",
    output: "The right place.",
    state: "LIVE",
    wired: null,
    apis: ["Google Places Autocomplete", "Google Places Text Search", "Place Details"],
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
    apis: ["Perplexity"],
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

/** Ranges for shape numbers that stay in the blob but are not console knobs. */
const HIDDEN_FIELD: Record<string, Pick<ParamField, "min" | "max" | "step">> = {
  kneeKm: { min: 0.1, max: 25, step: 0.1 },
  missingGeo: { min: 0, max: 1, step: 0.05 },
  openShare: { min: 0, max: 1, step: 0.05 },
  dead: { min: 0, max: 1, step: 0.05 },
  dawn: { min: 0, max: 1, step: 0.05 },
  breakfast: { min: 0, max: 1, step: 0.05 },
  midday: { min: 0, max: 1, step: 0.05 },
  evening: { min: 0, max: 1, step: 0.05 },
  late: { min: 0, max: 1, step: 0.05 },
  exact: { min: 0, max: 1, step: 0.05 },
  family: { min: 0, max: 1, step: 0.05 },
  miss: { min: 0, max: 1, step: 0.05 },
  priorRating: { min: 0, max: 5, step: 0.1 },
  confidence: { min: 1, max: 1000, step: 1 },
  floorRating: { min: 0, max: 4.9, step: 0.1 },
  unembedded: { min: 0, max: 1, step: 0.05 },
};

export const SIGNALS: {
  key: SignalKey;
  label: string;
  fn: string;
  input: string;
  process: string;
  output: string;
  fields: ParamField[];
  /** Vendor APIs this function calls at rank time. Empty = none. */
  apis: string[];
}[] = [
  {
    key: "proximity",
    label: "Proximity",
    fn: "proximity()",
    input: "Place geo × guest geo. No guest geo → abstains at 1.",
    process: "Haversine km, then 1 − log1p(km / knee) / log1p(max / knee).",
    output: "1 at the guest, 0 past maxKm. Unlocated place → missingGeo.",
    apis: [],
    fields: [{ key: "maxKm", label: "maxKm", min: 1, max: 200, step: 0.5 }],
  },
  {
    key: "timing",
    label: "Timing",
    fn: "timing()",
    input: "Weekly hours × the place's local clock.",
    process: "openShare × openOrFloor + (1 − openShare) × daypart(hour).",
    output: "Closed is demoted to closedFloor, never hidden.",
    apis: [],
    fields: [ZERO_ONE("closedFloor", "closedFloor")],
  },
  {
    key: "category",
    label: "Category",
    fn: "category()",
    input: "Place category/family × guest categories. Swipe states none.",
    process: "exact hit, else family hit, else miss. No intent → abstain.",
    output: "One of exact / family / miss.",
    apis: [],
    fields: UNIT,
  },
  {
    key: "popularity",
    label: "Popularity",
    fn: "popularity()",
    input: "Google rating + review count.",
    process: "(v·r + m·prior) / (v + m), then stretch from floorRating to 5.",
    output: "Unrated place gets the prior, never an abstention.",
    apis: [],
    fields: UNIT,
  },
  {
    key: "semantic",
    label: "Semantic",
    fn: "semantic()",
    input: "Query vector × places.embedding (Summary, never Presentation).",
    process: "(cosine + 1) / 2. No query → abstain.",
    output: "Unembedded place → unembedded, never deleted.",
    apis: [],
    fields: UNIT,
  },
  {
    key: "randomness",
    label: "Randomness",
    fn: "randomness()",
    input: "Nothing about the place. A uniform draw.",
    process: "rng() in [0, 1). The exponent is the only knob.",
    output: "A number that only breaks near-ties when the exponent is soft.",
    apis: [],
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
    for (const fieldKey of Object.keys(DEFAULT_SIGNAL_PARAMS[key])) {
      const field = spec?.fields.find((f) => f.key === fieldKey);
      const hidden = HIDDEN_FIELD[fieldKey];
      const fallback = DEFAULT_SIGNAL_PARAMS[key][fieldKey];
      const min = field?.min ?? hidden?.min ?? 0;
      const max = field?.max ?? hidden?.max ?? 1_000_000;
      const step = field?.step ?? hidden?.step ?? 0.01;
      const v = num(bag[fieldKey], fallback, min, max);
      const decimals = step >= 1 ? 0 : step >= 0.5 ? 1 : 2;
      const factor = 10 ** decimals;
      next[fieldKey] = Math.round(v * factor) / factor;
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
    catalog: coerceCatalog(r.catalog),
    social: coerceSocial(r.social),
    chat: {
      prompt: typeof (r.chat as { prompt?: unknown } | undefined)?.prompt === "string"
        ? (r.chat as { prompt: string }).prompt.slice(0, CHAT_PROMPT_MAX)
        : DEFAULT_CONFIG.chat.prompt,
    },
  };
}

export function coerceCatalog(raw: unknown): CatalogConfig {
  const c = (raw ?? {}) as Record<string, unknown>;
  return {
    seedCount: Math.round(num(c.seedCount, DEFAULT_CATALOG.seedCount, 0, CATALOG_COUNT_MAX)),
    generatedCount: Math.round(
      num(c.generatedCount, DEFAULT_CATALOG.generatedCount, 0, CATALOG_COUNT_MAX),
    ),
    placesPerRail: Math.round(
      num(
        c.placesPerRail,
        DEFAULT_CATALOG.placesPerRail,
        CATALOG_PLACES_PER_RAIL_MIN,
        CATALOG_PLACES_PER_RAIL_MAX,
      ),
    ),
    minSeedPlaces: Math.round(
      num(c.minSeedPlaces, DEFAULT_CATALOG.minSeedPlaces, 1, CATALOG_MIN_SEED_PLACES_MAX),
    ),
  };
}

export function coerceSocial(raw: unknown): SocialConfig {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    seedCount: Math.round(num(s.seedCount, DEFAULT_SOCIAL.seedCount, 0, SOCIAL_COUNT_MAX)),
    generatedCount: Math.round(
      num(s.generatedCount, DEFAULT_SOCIAL.generatedCount, 0, SOCIAL_COUNT_MAX),
    ),
    eventsPerRail: Math.round(
      num(
        s.eventsPerRail,
        DEFAULT_SOCIAL.eventsPerRail,
        SOCIAL_EVENTS_PER_RAIL_MIN,
        SOCIAL_EVENTS_PER_RAIL_MAX,
      ),
    ),
    minSeedEvents: Math.round(
      num(s.minSeedEvents, DEFAULT_SOCIAL.minSeedEvents, 1, SOCIAL_MIN_SEED_EVENTS_MAX),
    ),
    horizonDays: Math.round(
      num(
        s.horizonDays,
        DEFAULT_SOCIAL.horizonDays,
        SOCIAL_HORIZON_DAYS_MIN,
        SOCIAL_HORIZON_DAYS_MAX,
      ),
    ),
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
