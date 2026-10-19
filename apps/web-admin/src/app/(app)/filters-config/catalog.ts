// Discovery config — the console's twin of `_shared/discovery-config.ts`.
//
// Live HTML: ONE page, four pipeline boxes (MESITA-2327). Source, pipeline,
// signal and gate facts live in discovery-surface.ts, a tested copy of the
// Edge Function model. Family membership stays on Atlas.
//
// `coerceConfig` mirrors `normalizeDiscoveryConfig` key for key: this page
// saves the WHOLE blob, so a key it forgets is reset to its default on the
// server, and a key it keeps that the server dropped comes back on every
// Save. The EF twin's discovery-config.test.ts reads this file to pin it.
//
// RETIRED WITH THE SWIPE DECK (MESITA-2328): `weights`, `weightsByMode`,
// `engines`, the `swipe` slice and the deck's numbers on `params`. They are
// dropped on the next Save, never renamed.
//
// RETIRED WITH LIST-PLACES' LISTED LANES (MESITA-2337): the operator
// `filters`. Nothing read them once those lanes went; dropped on the next
// Save, like the deck's keys.

import { num } from "@/lib/config-coerce";

/** The guest's three modes, one row of the weights table each
 *  (MESITA-2428). Mirrors AREA_MODES in _shared/area-score.ts. */
export const AREA_MODES = ["nearby", "popular", "family"] as const;
export type AreaMode = (typeof AREA_MODES)[number];
export type AreaWeights = { proximity: number; popularity: number };

/**
 * The Area pipeline's numbers: Popularity's reviews for half credit and the
 * weights table, two exponents per mode (MESITA-2428). Proximity has no
 * number of its own — `map.radiusKm` is it. Mirrors SignalParams in
 * _shared/discovery-config.ts.
 */
export type SignalParams = {
  popularity: { halfReviews: number };
  modes: Record<AreaMode, AreaWeights>;
};

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
  params: SignalParams;
  general: GeneralConfig;
  catalog: CatalogConfig;
  map: MapConfig;
  name: NameConfig;
  deep: DeepConfig;
  chat: { prompt: string };
};

/** Mirrors DeepConfig in _shared/discovery-config.ts (MESITA-2327). */
export type DeepConfig = { limit: number; minSimilarity: number };
export const DEEP_LIMIT_MIN = 1;
export const DEEP_LIMIT_MAX = 20;
export const DEFAULT_DEEP: DeepConfig = { limit: 5, minSimilarity: 0 };

/** Mirrors the Area params' bounds and defaults in
 *  _shared/pipeline-signals.ts and discovery-config.ts (MESITA-2347). */
export const HALF_REVIEWS_MIN = 1;
export const HALF_REVIEWS_MAX = 100_000;
export const AREA_WEIGHT_MIN = 0;
export const AREA_WEIGHT_MAX = 5;

export type CatalogConfig = {
  seedCount: number;
  generatedCount: number;
  placesPerRail: number;
  /** Places per Feed row (MESITA-2319). Mirrors `catalog.railCap`. */
  railCap: number;
  minSeedPlaces: number;
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

/** Mirrors GOOGLE_PULL_STOPS in _shared/discovery-config.ts — the stops of
 *  `map.googlePlaces` and `map.mesitaPlaces`. */
export const GOOGLE_PULL_STOPS = [20, 40, 60] as const;
const GOOGLE_PULL_DEFAULT = 20;
/** Mirrors MAP_RADIUS_KM_* in _shared/discovery-config.ts. Max = Google's Nearby circle cap. */
export const MAP_RADIUS_KM_MIN = 1;
export const MAP_RADIUS_KM_MAX = 50;
const MAP_RADIUS_KM_DEFAULT = 50;
/** Same ceiling as map.minReviews — one reviewer floor reads like another. */
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
  /**
   * 20 / 40 / 60 — Google candidates on the Feed, places Mesita BUYS: 1/2/3
   * billed Nearby calls (MESITA-2379). The Map buys one call per load.
   */
  googlePlaces: number;
  /** 20 / 40 / 60 — Mesita candidates, a free read of our ready rows. */
  mesitaPlaces: number;
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

/** Google stars top out at 5: the ceiling of `map.minRating`. */
export const MIN_RATING_MAX = 5;
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
  googlePlaces: GOOGLE_PULL_DEFAULT,
  mesitaPlaces: GOOGLE_PULL_DEFAULT,
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

/** Mirrors DEFAULT_AREA_MODES and DEFAULT_SIGNAL_PARAMS. */
export const DEFAULT_AREA_MODES: Record<AreaMode, AreaWeights> = {
  nearby: { proximity: 2, popularity: 1 },
  popular: { proximity: 1, popularity: 2 },
  family: { proximity: 1, popularity: 1 },
};
const DEFAULT_SIGNAL_PARAMS: SignalParams = {
  popularity: { halfReviews: 100 },
  modes: DEFAULT_AREA_MODES,
};

export const DEFAULT_CONFIG: DiscoveryConfig = {
  params: DEFAULT_SIGNAL_PARAMS,
  general: DEFAULT_GENERAL,
  catalog: DEFAULT_CATALOG,
  map: DEFAULT_MAP,
  name: DEFAULT_NAME,
  deep: DEFAULT_DEEP,
  chat: { prompt: "" },
};

/** Round to the field's own decimals so a float cannot leave the page dirty. */
function bounded(raw: unknown, fallback: number, min: number, max: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(num(raw, fallback, min, max) * factor) / factor;
}

/**
 * The Area pipeline's three numbers. Mirrors `normalizeSignalParams`: rebuilt
 * field by field, so the retired deck's bags (maxKm, timing, category,
 * priorRating, …), the retired calibration (halfDistanceKm,
 * referenceRating/Reviews, MESITA-2347) and the linear `balance`
 * (MESITA-2428) are dropped on the next Save.
 */
function coerceParams(raw: unknown): SignalParams {
  const r = (raw ?? {}) as Record<string, unknown>;
  const pop = (r.popularity ?? {}) as Record<string, unknown>;
  const m = (r.modes ?? {}) as Record<string, unknown>;
  const d = DEFAULT_SIGNAL_PARAMS;
  return {
    popularity: {
      halfReviews: bounded(pop.halfReviews, d.popularity.halfReviews, HALF_REVIEWS_MIN, HALF_REVIEWS_MAX, 0),
    },
    modes: Object.fromEntries(
      AREA_MODES.map((mode) => {
        const row = (m[mode] ?? {}) as Record<string, unknown>;
        const dr = d.modes[mode];
        return [
          mode,
          {
            proximity: bounded(row.proximity, dr.proximity, AREA_WEIGHT_MIN, AREA_WEIGHT_MAX, 2),
            popularity: bounded(row.popularity, dr.popularity, AREA_WEIGHT_MIN, AREA_WEIGHT_MAX, 2),
          },
        ];
      }),
    ) as Record<AreaMode, AreaWeights>,
  };
}

/**
 * Tolerant read of whatever the EF returned, rebuilt key by key exactly like
 * `normalizeDiscoveryConfig`: a retired key (`weights`, `weightsByMode`,
 * `engines`, `swipe`, MESITA-2328; `filters`, MESITA-2337) is not carried
 * into the next Save.
 */
export function coerceConfig(raw: unknown): DiscoveryConfig {
  const r = (raw ?? {}) as Record<string, unknown>;

  return {
    params: coerceParams(r.params),
    general: coerceGeneral(r.general),
    catalog: coerceCatalog(r.catalog),
    map: coerceMap(r.map),
    name: coerceName(r.name),
    deep: coerceDeep(r.deep),
    chat: {
      prompt: typeof (r.chat as { prompt?: unknown } | undefined)?.prompt === "string"
        ? (r.chat as { prompt: string }).prompt.slice(0, CHAT_PROMPT_MAX)
        : DEFAULT_CONFIG.chat.prompt,
    },
  };
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

/** A scope cap: 20 / 40 / 60, snapped. Never a free number. */
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

function coerceDeep(raw: unknown): DeepConfig {
  const d = (raw ?? {}) as Record<string, unknown>;
  return {
    limit: Math.round(num(d.limit, DEFAULT_DEEP.limit, DEEP_LIMIT_MIN, DEEP_LIMIT_MAX)),
    minSimilarity: Math.round(num(d.minSimilarity, DEFAULT_DEEP.minSimilarity, 0, 1) * 100) / 100,
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
    // Rebuilt key by key: an old blob's `googlePull` (the retired Legacy
    // pull, MESITA-2298) and `pinCount` (MESITA-2347) are dropped on the
    // next save; a stored `pinCount` seeds both caps once.
    googlePlaces: coerceGooglePull(m.googlePlaces ?? m.pinCount),
    mesitaPlaces: coerceGooglePull(m.mesitaPlaces ?? m.pinCount),
    radiusKm:
      Math.round(
        num(m.radiusKm, DEFAULT_MAP.radiusKm, MAP_RADIUS_KM_MIN, MAP_RADIUS_KM_MAX) * 10,
      ) / 10,
    googleMinReviews: Math.round(
      num(m.googleMinReviews, DEFAULT_MAP.googleMinReviews, 0, 100_000),
    ),
  };
}
