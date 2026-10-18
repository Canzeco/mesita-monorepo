// Discovery catalog — the operator-facing mirror of the signal library.
//
// The vocabulary lives in code on the Edge Function side
// (`supabase/functions/_shared/discovery-signals.ts` SIGNAL_KEYS) and this file
// mirrors it: the console edits NUMBERS, never the list of signals. Adding a
// signal is a code change in both packages — deliberately, because a signal
// nobody wrote has nothing to score.
//
// Live HTML: four subpages — Sources, Modes, Catalog, Matrix. The index
// opens Sources. Mode, source, and routing facts live in discovery-surface.ts,
// which is a tested copy of the Edge Function surface. Catalog weights are
// the three signals catalogScore multiplies. Map and Swipe exponents stay
// on Modes. Routing is fixed. Family membership stays on Atlas.
//   SIGNALS   seven earned signals: Name · Family · Proximity · Timing ·
//             Enriched · Popularity · Randomness. None reads money.
//             Partnership and Promotion merged into Mesita Level and Social
//             left the library (MESITA-1408); Social then left the mode list
//             too, and is now Mesita Social Catalog Search. Mesita Level is Enriched now
//             (MESITA-1858), and an old blob's `mesita_level` folds onto it.
//             Summary left at MESITA-2144: no caller ever built its query
//             vector, so it scored every place 1 and could reorder nothing.
//
// Operator filters still live on the blob so a whole-blob Save cannot
// reset them. They have no knobs on this page.

import { num } from "@/lib/config-coerce";

// Signal order — Notion Docs > Discovery section 8.3. What the caller ASKED
// FOR first, then what the world is, then where the place sits with us, then
// the tie-breaker. Presentation only: the blend is a product, so order cannot
// change a score.
export const SIGNAL_KEYS = [
  "name",
  "category",
  "proximity",
  "timing",
  "enriched",
  "popularity",
  "randomness",
] as const;

export type SignalKey = (typeof SIGNAL_KEYS)[number];

export type SignalParamBag = Record<string, number>;
export type SignalParams = Record<SignalKey, SignalParamBag>;

export type NameFastConfig = {
  /** Redundant with count on Fast — one source. Locked together. */
  googleCount: number;
  count: number;
  supers: Record<SuperParamKey, boolean>;
};

export type NameDeepConfig = {
  mesitaCount: number;
  /** Google Autocomplete cap. Independent query. */
  autoCount: number;
  /** Google Text Search cap. Independent query. */
  googleCount: number;
  supers: Record<SuperParamKey, boolean>;
};

export type NameConfig = {
  fast: NameFastConfig;
  deep: NameDeepConfig;
  /** Word's Locations on the consumer bar (MESITA-2319). */
  locations: boolean;
  /** Word's idle seconds before the one search runs (MESITA-2322). */
  idleSec: number;
  /** Word by Admin: Single Place › Find's caps (MESITA-2322). */
  admin: NameAdminConfig;
};

export type NameAdminConfig = {
  autoCount: number;
  textCount: number;
  mesitaCount: number;
  emptyQuery: boolean;
};

/**
 * Scroll admission knobs. Mirrors SwipeConfig in _shared/discovery-config.ts.
 *
 * THE FIVE 2026-08-26 RANKING KNOBS ARE GONE (MESITA-1859): weightProximity,
 * starsExponent, logDivisor, partnerBias and randomnessMax carried the retired
 * two-signal SUM and had sat unread since the blend replaced it. A dead
 * `weightProximity` beside a live per-mode Proximity exponent reads as a
 * second, competing dial. The unread `categoryFilter` went the same way.
 */
export type SwipeConfig = {
  radiusKm: number;
  closingBufferMin: number;
  minReviews: number;
  savedAt: string | null;
};

export type GeneralConfig = {
  /**
   * The post-Google wipe. Active is `business_state === "OPERATIONAL"` on
   * Mesita, Google's `businessStatus` on a Google-only row. Unknown does not
   * clear it. Mirrors `_shared/discovery-general-gate.ts`.
   */
  requireActive: boolean;
  /** Google reviews a place must prove to survive the wipe. 0 = off. */
  minReviews: number;
};

export type DiscoveryConfig = {
  /** Word's vector, and the fallback under every mode with no column. */
  weights: Record<SignalKey, number>;
  /** One exponent vector per wired mode (MESITA-1859). Mask stays outer. */
  weightsByMode: Record<WeightedModeKey, Record<SignalKey, number>>;
  params: SignalParams;
  filters: DiscoveryFilters;
  engines: Record<WiredEngineKey, { ranked: boolean }>;
  general: GeneralConfig;
  catalog: CatalogConfig;
  map: MapConfig;
  name: NameConfig;
  chat: { prompt: string };
  swipe: SwipeConfig;
};

/** Mirrors CATALOG_RANK_KEYS in _shared/discovery-config.ts. One shared profile. */
export const CATALOG_RANK_KEYS = [
  "name",
  "description",
  "proximity",
  "enriched",
  "popularity",
  "selected",
  "randomness",
] as const;
export type CatalogRankKey = (typeof CATALOG_RANK_KEYS)[number];

/** Mirrors DEFAULT_CATALOG_RANKING in _shared/discovery-config.ts. Name ships off; Enriched ships at 2. */
export const DEFAULT_CATALOG_RANKING: Record<CatalogRankKey, number> = {
  name: 0,
  description: 1,
  proximity: 1,
  enriched: 2,
  popularity: 1,
  selected: 1,
  randomness: 0,
};

export type CatalogConfig = {
  seedCount: number;
  generatedCount: number;
  placesPerRail: number;
  /** Places per Feed row (MESITA-2319). Mirrors `catalog.railCap`. */
  railCap: number;
  minSeedPlaces: number;
  ranking: Record<CatalogRankKey, number>;
};

// Mirrors SUPER_PARAM_KEYS in _shared/discovery-config.ts, itself pinned to
// the taxonomy by google-type-super.test.ts. The operator's category param is
// the SUPER, not Google's slug (MESITA-1695): fifteen switches in Google's
// vocabulary, capped by an ordered "first N", is what let four whole families
// sit invisibly off. Order is the guest's — FAMILIES sort_order.
export const SUPER_PARAM_KEYS = [
  "coffee",
  "breakfast",
  "quick_bite",
  "pizza",
  "tacos",
  "sushi",
  "burgers",
  "noodles",
  "dinner",
  "sweet",
  "drinks",
  "night_out",
  "go_out",
  "move",
  "feel_better",
] as const;
export type SuperParamKey = (typeof SUPER_PARAM_KEYS)[number];

/** Mirrors GOOGLE_PULL_STOPS in _shared/discovery-config.ts — `map.pinCount`'s stops. */
export const GOOGLE_PULL_STOPS = [20, 40, 60] as const;
const GOOGLE_PULL_DEFAULT = 20;
/** Mirrors MAP_RADIUS_KM_* in _shared/discovery-config.ts. Max = Google's Nearby circle cap. */
export const MAP_RADIUS_KM_MIN = 1;
export const MAP_RADIUS_KM_MAX = 50;
const MAP_RADIUS_KM_DEFAULT = 50;
/** Same ceiling as filters.minReviews — one reviewer floor reads like another. */
export const GENERAL_MIN_REVIEWS_MAX = 100_000;

export type MapConfig = {
  minRating: number;
  minReviews: number;
  minPopularity: number;
  /** Camera must move at least this far (km) before Search refetches Nearby. */
  reloadMinKm: number;
  /** Wait at least this long (seconds) after a fetch before Search refetches. */
  reloadMinSec: number;
  googleFill: boolean;
  supers: Record<SuperParamKey, boolean>;
  /** 20 / 40 / 60 — how many pins the map query returns. Was the guest's. */
  pinCount: number;
  /**
   * The one Nearby radius (km), shared by the Map and the Feed's Google
   * Places and Mesita Selected rails (MESITA-2298). Never the guest's.
   */
  radiusKm: number;
  /** Operator Google reviews floor, Google hits only (MESITA-2319). 0 = off. */
  googleMinReviews: number;
};

/**
 * The seven params the operator actually sees. `label` and `emoji` are
 * verbatim from FAMILIES in _shared/place-taxonomy.ts; `battery` is
 * the Google slugs that family sends, shown read-only so the box says what it
 * bills without asking anyone to toggle Google's vocabulary.
 */
export const SUPER_FIELDS: {
  key: SuperParamKey;
  label: string;
  emoji: string;
  battery: readonly string[];
}[] = [
  { key: "coffee", label: "Coffee", emoji: "☕", battery: ["cafe"] },
  { key: "breakfast", label: "Breakfast", emoji: "🥐", battery: ["breakfast_restaurant"] },
  { key: "quick_bite", label: "Quick bite", emoji: "🥙", battery: ["fast_food_restaurant"] },
  { key: "pizza", label: "Pizza", emoji: "🍕", battery: ["pizza_restaurant"] },
  { key: "tacos", label: "Tacos", emoji: "🌮", battery: ["mexican_restaurant"] },
  { key: "sushi", label: "Sushi", emoji: "🍣", battery: ["sushi_restaurant"] },
  { key: "burgers", label: "Burgers", emoji: "🍔", battery: ["hamburger_restaurant"] },
  { key: "noodles", label: "Noodles", emoji: "🍜", battery: ["ramen_restaurant"] },
  { key: "dinner", label: "Dinner", emoji: "🍝", battery: ["restaurant"] },
  { key: "sweet", label: "Sweet", emoji: "🍰", battery: ["bakery"] },
  { key: "drinks", label: "Drinks", emoji: "🍸", battery: ["bar"] },
  { key: "night_out", label: "Night out", emoji: "🌙", battery: ["night_club"] },
  { key: "go_out", label: "Go out", emoji: "🎟️", battery: ["tourist_attraction", "bowling_alley", "movie_theater"] },
  { key: "move", label: "Move", emoji: "🏃", battery: ["gym", "fitness_center", "yoga_studio", "sports_club"] },
  { key: "feel_better", label: "Feel better", emoji: "💆", battery: ["spa", "beauty_salon", "hair_salon", "massage"] },
];

export type ParamField = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
};

export type DiscoveryFilters = {
  /** The Enriched gate — `enriched_at IS NOT NULL` AND `content_state =
   *  'ready'` (MESITA-2154). The stored key keeps its old name: renaming it
   *  would reset the operator's value. */
  requireReady: boolean;
  minRating: number;
  minReviews: number;
  maxDistanceKm: number;
};

/** Mirrors WIRED_ENGINE_KEYS in _shared/discovery-config.ts. */
const WIRED_ENGINE_KEYS = ["swipe"] as const;
type WiredEngineKey = (typeof WIRED_ENGINE_KEYS)[number];

/**
 * Mirrors WEIGHTED_MODE_KEYS in _shared/discovery-matrix.ts — the modes that
 * earn a column in the weights table on Discovery Modes (MESITA-1859).
 *
 * A mode is here when BOTH halves hold: some non-test file calls
 * `weightsForMode` for it, AND its mask carries more than one signal. Word
 * satisfies the first and fails the second — its mask is `["name"]`, and a
 * one-factor `s^w` is a monotone transform of `s`, so no exponent can reorder
 * a Word result. Catalog ranks on its own profile, not this table; Chat and Favorites have no engine, and
 * Favorites' mask is empty besides.
 *
 * Map is real too (MESITA-2298): the shared engine ranks every Google Places
 * selection — the Map's Google scope and the Feed's Google Places rail — with
 * this column, so its badge reads Enforced.
 *
 * The EF twin's own contract test asserts both halves. These are PERSISTED
 * keys: `swipe` is the stored key and Scroll is only its label.
 */
export const WEIGHTED_MODE_KEYS = ["map", "swipe"] as const;
export type WeightedModeKey = (typeof WEIGHTED_MODE_KEYS)[number];

/** Mirrors WEIGHT_MIN / WEIGHT_MAX in _shared/discovery-config.ts. */
export const WEIGHT_MIN = 0;
export const WEIGHT_MAX = 4;

/**
 * Mirrors SIGNAL_WEIGHT_MAX / weightMaxFor in _shared/discovery-config.ts.
 *
 * `enriched` is capped at 2, not the uniform 4, because it floors far below
 * the ~0.85 the uniform ceiling was reasoned from: at 0.15 its span is
 * ~6.67^w (44x at 2, ~1,975x at 4). At the uniform ceiling it stops being a
 * weight and becomes a filter.
 *
 * The EF clamps this server-side either way — the mirror is here so the
 * console's dial cannot offer a number the backend will silently refuse.
 */
export const SIGNAL_WEIGHT_MAX: Partial<Record<SignalKey, number>> = {
  enriched: 2,
};

export function weightMaxFor(key: SignalKey): number {
  return SIGNAL_WEIGHT_MAX[key] ?? WEIGHT_MAX;
}
/** Google stars top out at 5. Exported since MESITA-1667 gave `filters` a box. */
export const MIN_RATING_MAX = 5;
const MAX_DISTANCE_KM_MAX = 200;
const CATALOG_COUNT_MAX = 20;
const CATALOG_PLACES_PER_RAIL_MIN = 4;
const CATALOG_PLACES_PER_RAIL_MAX = 20;
const CATALOG_MIN_SEED_PLACES_MAX = 20;
const MAP_MIN_POPULARITY_MAX = 1;
/** Categorical reload pairs. Both must be true. Rail / pin pans do not count. */
export const MAP_RELOAD_PAIRS = [
  { km: 0.25, sec: 1 },
  { km: 0.5, sec: 2 },
  { km: 1, sec: 4 },
  { km: 2, sec: 8 },
  { km: 4, sec: 15 },
] as const;

export function snapMapReloadPair(
  km: unknown,
  sec: unknown,
): { km: number; sec: number } {
  const fallback = MAP_RELOAD_PAIRS[1];
  const k = typeof km === "number" && Number.isFinite(km) ? km : fallback.km;
  const s = typeof sec === "number" && Number.isFinite(sec) ? sec : fallback.sec;
  let best: (typeof MAP_RELOAD_PAIRS)[number] = fallback;
  let bestD = Number.POSITIVE_INFINITY;
  for (const pair of MAP_RELOAD_PAIRS) {
    const d = Math.abs(pair.km - k) / 0.25 + Math.abs(pair.sec - s);
    if (d < bestD) {
      best = pair;
      bestD = d;
    }
  }
  return { km: best.km, sec: best.sec };
}
/** Map Places-set caps. Mesita max 60; Google Nearby max 20. */
export const NAME_LANE_COUNT_MAX = 20;
const NAME_FAST_COUNT_DEFAULT = 5;
const NAME_MESITA_COUNT_DEFAULT = 3;
const NAME_GOOGLE_COUNT_DEFAULT = 3;

/** Exported since MESITA-1859 gave Scroll a live card with three fields. */
export const SWIPE_RADIUS_KM_MIN = 1;
export const SWIPE_RADIUS_KM_MAX = 50;
const SWIPE_CLOSING_BUFFER_MIN = 0;
export const SWIPE_CLOSING_BUFFER_MAX = 180;
/** Mirrors CHAT_PROMPT_MAX in _shared/discovery-config.ts. */
const CHAT_PROMPT_MAX = 12_000;

/** Mirrors CATALOG_RAIL_CAP_* in _shared/discovery-config.ts. */
export const CATALOG_RAIL_CAP_MIN = 1;
export const CATALOG_RAIL_CAP_MAX = 10;
const CATALOG_RAIL_CAP_DEFAULT = 5;

export const DEFAULT_CATALOG: CatalogConfig = {
  seedCount: 8,
  generatedCount: 8,
  placesPerRail: 8,
  railCap: CATALOG_RAIL_CAP_DEFAULT,
  minSeedPlaces: 2,
  ranking: { ...DEFAULT_CATALOG_RANKING },
};

// The three supers the strip always asked for stay on; the four it could not
// see default OFF. Not a cost choice: one Nearby request carries every enabled
// type, so types are free (MESITA-1685). Off because it keeps the returned pool
// unchanged until an operator widens it deliberately.
const DEFAULT_MAP_SUPERS: Record<SuperParamKey, boolean> = {
  coffee: true,
  breakfast: false,
  quick_bite: false,
  pizza: false,
  tacos: false,
  sushi: false,
  burgers: false,
  noodles: false,
  dinner: true,
  sweet: true,
  drinks: true,
  night_out: true,
  go_out: false,
  move: false,
  feel_better: false,
};

export const DEFAULT_MAP: MapConfig = {
  minRating: 0,
  minReviews: 0,
  minPopularity: 0,
  reloadMinKm: 0.5,
  reloadMinSec: 2,
  googleFill: true,
  supers: DEFAULT_MAP_SUPERS,
  pinCount: GOOGLE_PULL_DEFAULT,
  radiusKm: MAP_RADIUS_KM_DEFAULT,
  googleMinReviews: 0,
};

const DEFAULT_NAME_FAST: NameFastConfig = {
  googleCount: NAME_FAST_COUNT_DEFAULT,
  count: NAME_FAST_COUNT_DEFAULT,
  supers: DEFAULT_MAP_SUPERS,
};

const DEFAULT_NAME_DEEP: NameDeepConfig = {
  mesitaCount: NAME_MESITA_COUNT_DEFAULT,
  autoCount: NAME_GOOGLE_COUNT_DEFAULT,
  googleCount: NAME_GOOGLE_COUNT_DEFAULT,
  supers: DEFAULT_MAP_SUPERS,
};

/** Mirrors NAME_IDLE_SEC_* / NAME_ADMIN_* in _shared/discovery-config.ts. */
export const NAME_IDLE_SEC_MIN = 0.3;
export const NAME_IDLE_SEC_MAX = 5;
export const NAME_ADMIN_TEXT_MAX = 20;
export const NAME_ADMIN_MESITA_MAX = 10;

export const DEFAULT_NAME_ADMIN: NameAdminConfig = {
  autoCount: 0,
  textCount: NAME_ADMIN_TEXT_MAX,
  mesitaCount: NAME_ADMIN_MESITA_MAX,
  emptyQuery: true,
};

export const DEFAULT_NAME: NameConfig = {
  fast: DEFAULT_NAME_FAST,
  deep: DEFAULT_NAME_DEEP,
  locations: true,
  idleSec: 1,
  admin: DEFAULT_NAME_ADMIN,
};

export const DEFAULT_GENERAL: GeneralConfig = {
  requireActive: true,
  minReviews: 0,
};

export const DEFAULT_SWIPE: SwipeConfig = {
  radiusKm: 5,
  closingBufferMin: 30,
  minReviews: 1,
  savedAt: null,
};

/** Mirrors DISCOVERY_DEFAULTS. Used only as the seed on a failed load. */
const DEFAULT_SIGNAL_PARAMS: SignalParams = {
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
  // Zero params since MESITA-2144: `unembedded` was never a knob, and `name`
  // falls back to its own 0.4 in _shared/discovery-signals.ts.
  name: {},
  // Zero params, exact parity with the `mesita_level` row it replaces.
  enriched: {},
  randomness: {},
};

const DEFAULT_WEIGHTS: Record<SignalKey, number> = {
  proximity: 1,
  timing: 1,
  category: 1,
  popularity: 1,
  name: 1,
  enriched: 1,
  randomness: 0.35,
};

/**
 * Mirrors DISCOVERY_DEFAULTS.weightsByMode. Day zero equals the global vector
 * per wired mode, so the first deploy moves no deck. The `Reset to defaults`
 * ghost button on each column writes this back.
 */
export const DEFAULT_WEIGHTS_BY_MODE: Record<
  WeightedModeKey,
  Record<SignalKey, number>
> = Object.fromEntries(
  WEIGHTED_MODE_KEYS.map((mode) => [mode, { ...DEFAULT_WEIGHTS }]),
) as Record<WeightedModeKey, Record<SignalKey, number>>;

export const DEFAULT_CONFIG: DiscoveryConfig = {
  weights: DEFAULT_WEIGHTS,
  weightsByMode: DEFAULT_WEIGHTS_BY_MODE,
  params: DEFAULT_SIGNAL_PARAMS,
  filters: { requireReady: true, minRating: 0, minReviews: 0, maxDistanceKm: 0 },
  engines: { swipe: { ranked: true } },
  general: DEFAULT_GENERAL,
  catalog: DEFAULT_CATALOG,
  map: DEFAULT_MAP,
  name: DEFAULT_NAME,
  chat: { prompt: "" },
  swipe: DEFAULT_SWIPE,
};

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
};

export {
  DISCOVERY_MODE_KEYS,
  DISCOVERY_MODE_LABELS,
  DISCOVERY_ENTITIES,
  DISCOVERY_POOLS,
  DISCOVERY_SOURCES,
  DISCOVERY_SOURCES_NO_CALLER,
  DISCOVERY_MODE_SOURCES,
  modeReturnsEntity,
  modeRequiresPool,
  modeCallsSource,
  modeSignalState,
} from "./discovery-matrix";

export const SIGNALS: {
  key: SignalKey;
  label: string;
  input: string;
  output: string;
  fields: ParamField[];
}[] = [
  {
    key: "name",
    label: "Name",
    input: "How close a typed name is to the place's name.",
    output: "No name to compare, every place scores the same. A place with no name of its own scores low, not zero.",
    fields: UNIT,
  },
  {
    key: "proximity",
    label: "Proximity",
    input: "Distance from the guest to the place. Close places score high. The score falls on a curve and reaches zero at Max km.",
    output: "No guest location, every place scores the same. A place with no coordinates scores low.",
    fields: [{ key: "maxKm", label: "Max km", min: 1, max: 200, step: 0.5 }],
  },
  {
    key: "timing",
    label: "Timing",
    input: "Whether the place is open, and whether this is its hour, on the place's own clock.",
    output: "A closed place is pushed down to Closed floor. It is never removed.",
    fields: [ZERO_ONE("closedFloor", "Closed floor")],
  },
  {
    key: "category",
    label: "Family",
    input: "Whether the place's type matches what the guest asked for.",
    output: "An exact type scores full. The same family scores in the middle. A miss scores low. No request, every place scores the same.",
    fields: UNIT,
  },
  {
    key: "popularity",
    label: "Popularity",
    input: "The place's rating, pulled toward the usual rating by how many reviews it has.",
    output: "A perfect rating from a few reviews does not beat a strong rating from many. No rating uses the usual rating.",
    fields: UNIT,
  },
  {
    key: "enriched",
    label: "Enriched",
    input: "How far Mesita got while building this place.",
    output: "A finished place scores full. A place Mesita has not worked on scores low.",
    fields: UNIT,
  },
  {
    key: "randomness",
    label: "Randomness",
    input: "A fresh draw. It reads nothing about the place.",
    output: "It only breaks ties between places that otherwise score the same.",
    fields: UNIT,
  },
];

/**
 * Retired signal keys an old blob may still carry. Mirrors
 * LEGACY_SIGNAL_ALIASES in _shared/discovery-config.ts.
 *
 *   mesita_level  → enriched   (MESITA-1858)
 *
 * An explicitly-set new key always wins over the alias.
 */
const LEGACY_SIGNAL_ALIASES: Record<string, readonly SignalKey[]> = {
  mesita_level: ["enriched"],
};

const warnedLegacyKeys = new Set<string>();

/** Test seam: the structured warn below fires once per key per page load. */
export function resetLegacySignalWarnings(): void {
  warnedLegacyKeys.clear();
}

/**
 * Weights only (MESITA-2144), like the EF twin: `enriched` has no params, so
 * a params fold could only ever copy the retired bag's `{}`.
 */
function foldLegacySignalBag(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...raw };
  for (const [legacy, targets] of Object.entries(LEGACY_SIGNAL_ALIASES)) {
    const value = next[legacy];
    if (value == null) continue;
    const foldedTo: SignalKey[] = [];
    for (const target of targets) {
      if (next[target] == null) {
        next[target] = value;
        foldedTo.push(target);
      }
    }
    if (!warnedLegacyKeys.has(legacy)) {
      warnedLegacyKeys.add(legacy);
      console.warn("[filters-config] legacy signal key", {
        key: legacy,
        value,
        foldedTo,
        preserved: true,
      });
    }
  }
  return next;
}

/**
 * Tolerant read of whatever the EF returned.
 *
 * THE WEIGHTS MAP IS ADDITIVE (MESITA-1858), matching
 * `normalizeDiscoveryConfig`. This page does a WHOLE-BLOB save, and it deploys
 * on merge while the Edge Functions deploy by hand — so between the two, a
 * rebuild-from-SIGNAL_KEYS here would evict a key the still-old EF reads the
 * moment an operator saved any unrelated section, and that EF would read a
 * deliberately-set number back as its default. Preserving unknown weight keys
 * is what makes that window survivable rather than destructive.
 *
 * Exponents round to two decimals for the same reason the EF normalizer does:
 * the field steps in 0.05, and a float landing at 1.7000000000000002 would
 * leave the page permanently `dirty` against its own saved value.
 */
export function coerceConfig(raw: unknown): DiscoveryConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const w = foldLegacySignalBag((r.weights ?? {}) as Record<string, unknown>);

  const weights: Record<string, number> = {};
  // Unknown keys first, so a known key always overwrites a stale one.
  for (const [key, raw] of Object.entries(w)) {
    if ((SIGNAL_KEYS as readonly string[]).includes(key)) continue;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n)) continue;
    weights[key] = Math.round(Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, n)) * 100) / 100;
  }
  for (const key of SIGNAL_KEYS) {
    const v = num(w[key], DEFAULT_CONFIG.weights[key], WEIGHT_MIN, weightMaxFor(key));
    weights[key] = Math.round(v * 100) / 100;
  }

  // Per-mode exponents (MESITA-1859). Mirrors normalizeDiscoveryConfig's own
  // branch EXACTLY, including the fallback: a missing column seeds from THIS
  // BLOB's vector, never from DEFAULT_CONFIG. The live config carries
  // hand-tuned global exponents, and seeding from the in-code defaults would
  // quietly revert every one of them the first time the page loaded.
  const rawByMode = (r.weightsByMode ?? {}) as Record<string, unknown>;
  const weightsByMode = {} as Record<WeightedModeKey, Record<SignalKey, number>>;
  for (const mode of WEIGHTED_MODE_KEYS) {
    const bag = (rawByMode[mode] ?? {}) as Record<string, unknown>;
    const col = {} as Record<SignalKey, number>;
    for (const key of SIGNAL_KEYS) {
      const v = num(bag[key], weights[key], WEIGHT_MIN, weightMaxFor(key));
      col[key] = Math.round(v * 100) / 100;
    }
    weightsByMode[mode] = col;
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

  // No legacy fold here: a stored `params` key outside SIGNAL_KEYS,
  // `mesita_level` included, is simply not rebuilt.
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
    weights: weights as Record<SignalKey, number>,
    weightsByMode,
    params,
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
    general: coerceGeneral(r.general),
    catalog: coerceCatalog(r.catalog),
    map: coerceMap(r.map),
    name: coerceName(r.name),
    chat: {
      prompt: typeof (r.chat as { prompt?: unknown } | undefined)?.prompt === "string"
        ? (r.chat as { prompt: string }).prompt.slice(0, CHAT_PROMPT_MAX)
        : DEFAULT_CONFIG.chat.prompt,
    },
    swipe: coerceSwipe(r.swipe),
  };
}

function coerceSavedAt(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function coerceSwipe(raw: unknown): SwipeConfig {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    radiusKm: Math.round(
      num(s.radiusKm, DEFAULT_SWIPE.radiusKm, SWIPE_RADIUS_KM_MIN, SWIPE_RADIUS_KM_MAX) * 10,
    ) / 10,
    closingBufferMin: Math.round(
      num(
        s.closingBufferMin,
        DEFAULT_SWIPE.closingBufferMin,
        SWIPE_CLOSING_BUFFER_MIN,
        SWIPE_CLOSING_BUFFER_MAX,
      ),
    ),
    minReviews: Math.round(num(s.minReviews, DEFAULT_SWIPE.minReviews, 0, 100_000)),
    savedAt: coerceSavedAt(s.savedAt),
  };
}

function coerceCatalogRanking(raw: unknown): Record<CatalogRankKey, number> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out = {} as Record<CatalogRankKey, number>;
  for (const key of CATALOG_RANK_KEYS) {
    const v = num(r[key], DEFAULT_CATALOG_RANKING[key], WEIGHT_MIN, WEIGHT_MAX);
    out[key] = Math.round(v * 100) / 100;
  }
  return out;
}

function coerceCatalog(raw: unknown): CatalogConfig {
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
    railCap: Math.round(
      num(c.railCap, DEFAULT_CATALOG.railCap, CATALOG_RAIL_CAP_MIN, CATALOG_RAIL_CAP_MAX),
    ),
    minSeedPlaces: Math.round(
      num(c.minSeedPlaces, DEFAULT_CATALOG.minSeedPlaces, 1, CATALOG_MIN_SEED_PLACES_MAX),
    ),
    ranking: coerceCatalogRanking(c.ranking),
  };
}

/**
 * Mirrors `normalizeSuperParams` in _shared/discovery-config.ts. A blob with
 * no boolean Super key reads the defaults; otherwise a missing or non-boolean
 * key falls back to its own default.
 */
function coerceSuperParams(raw: unknown): Record<SuperParamKey, boolean> {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (!SUPER_PARAM_KEYS.some((key) => typeof r[key] === "boolean")) {
    return { ...DEFAULT_MAP_SUPERS };
  }
  const out = {} as Record<SuperParamKey, boolean>;
  for (const key of SUPER_PARAM_KEYS) {
    out[key] = typeof r[key] === "boolean"
      ? (r[key] as boolean)
      : DEFAULT_MAP_SUPERS[key];
  }
  return out;
}

/** `pinCount`: 20 / 40 / 60, snapped. Never a free number. */
function coerceGooglePull(raw: unknown): number {
  const n = num(raw, GOOGLE_PULL_DEFAULT, GOOGLE_PULL_STOPS[0], GOOGLE_PULL_STOPS[2]);
  let best: number = GOOGLE_PULL_DEFAULT;
  for (const stop of GOOGLE_PULL_STOPS) {
    if (Math.abs(stop - n) < Math.abs(best - n)) best = stop;
  }
  return best;
}

function coerceGeneral(raw: unknown): GeneralConfig {
  const g = (raw ?? {}) as Record<string, unknown>;
  return {
    requireActive:
      typeof g.requireActive === "boolean"
        ? g.requireActive
        : DEFAULT_GENERAL.requireActive,
    minReviews: Math.round(
      num(g.minReviews, DEFAULT_GENERAL.minReviews, 0, GENERAL_MIN_REVIEWS_MAX),
    ),
  };
}

function coerceName(raw: unknown): NameConfig {
  const n = (raw ?? {}) as Record<string, unknown>;
  const fast = (n.fast ?? {}) as Record<string, unknown>;
  const deep = (n.deep ?? {}) as Record<string, unknown>;
  const fastCount = Math.round(
    num(fast.count, DEFAULT_NAME_FAST.count, 0, NAME_LANE_COUNT_MAX),
  );
  return {
    fast: {
      googleCount: Math.round(
        num(fast.googleCount ?? fast.count, fastCount, 0, NAME_LANE_COUNT_MAX),
      ),
      count: fastCount,
      supers: coerceSuperParams(fast.supers),
    },
    deep: {
      mesitaCount: Math.round(
        num(deep.mesitaCount, DEFAULT_NAME_DEEP.mesitaCount, 0, NAME_LANE_COUNT_MAX),
      ),
      autoCount: Math.round(
        num(deep.autoCount, DEFAULT_NAME_DEEP.autoCount, 0, NAME_LANE_COUNT_MAX),
      ),
      googleCount: Math.round(
        num(deep.googleCount, DEFAULT_NAME_DEEP.googleCount, 0, NAME_LANE_COUNT_MAX),
      ),
      supers: coerceSuperParams(deep.supers),
    },
    locations: typeof n.locations === "boolean" ? n.locations : DEFAULT_NAME.locations,
    idleSec:
      Math.round(num(n.idleSec, DEFAULT_NAME.idleSec, NAME_IDLE_SEC_MIN, NAME_IDLE_SEC_MAX) * 10) /
      10,
    admin: coerceNameAdmin(n.admin),
  };
}

function coerceNameAdmin(raw: unknown): NameAdminConfig {
  const a = (raw ?? {}) as Record<string, unknown>;
  return {
    autoCount: Math.round(num(a.autoCount, DEFAULT_NAME_ADMIN.autoCount, 0, NAME_LANE_COUNT_MAX)),
    textCount: Math.round(num(a.textCount, DEFAULT_NAME_ADMIN.textCount, 1, NAME_ADMIN_TEXT_MAX)),
    mesitaCount: Math.round(
      num(a.mesitaCount, DEFAULT_NAME_ADMIN.mesitaCount, 1, NAME_ADMIN_MESITA_MAX),
    ),
    emptyQuery: typeof a.emptyQuery === "boolean" ? a.emptyQuery : DEFAULT_NAME_ADMIN.emptyQuery,
  };
}

function coerceMap(raw: unknown): MapConfig {
  const m = (raw ?? {}) as Record<string, unknown>;
  const supers = coerceSuperParams(m.supers);
  const reload = snapMapReloadPair(m.reloadMinKm, m.reloadMinSec);
  return {
    minRating: Math.round(
      num(m.minRating, DEFAULT_MAP.minRating, 0, MIN_RATING_MAX) * 10,
    ) / 10,
    minReviews: Math.round(num(m.minReviews, DEFAULT_MAP.minReviews, 0, 100_000)),
    minPopularity: Math.round(
      num(m.minPopularity, DEFAULT_MAP.minPopularity, 0, MAP_MIN_POPULARITY_MAX) * 100,
    ) / 100,
    reloadMinKm: reload.km,
    reloadMinSec: reload.sec,
    googleFill: typeof m.googleFill === "boolean" ? m.googleFill : DEFAULT_MAP.googleFill,
    supers,
    pinCount: coerceGooglePull(m.pinCount),
    // Rebuilt key by key: an old blob's `googlePull` (the retired Legacy
    // pull, MESITA-2298) is dropped on the next save.
    radiusKm:
      Math.round(
        num(m.radiusKm, DEFAULT_MAP.radiusKm, MAP_RADIUS_KM_MIN, MAP_RADIUS_KM_MAX) * 10,
      ) / 10,
    googleMinReviews: Math.round(
      num(m.googleMinReviews, DEFAULT_MAP.googleMinReviews, 0, 100_000),
    ),
  };
}
