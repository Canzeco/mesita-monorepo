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

/**
 * The Area pipeline's one stored signal number: Popularity's reviews for
 * half credit. The exponents live on `map`; Proximity's reach is the
 * request's radius (MESITA-2703). Mirrors SignalParams in
 * _shared/discovery-config.ts.
 */
export type SignalParams = {
  popularity: { halfReviews: number };
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
  // `minReviews` retired (MESITA-2702): the one floor is `map.googleMinReviews`.
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

/** Mirrors the Popularity bounds in _shared/pipeline-signals.ts. */
export const HALF_REVIEWS_MIN = 1;
export const HALF_REVIEWS_MAX = 100_000;

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
// the SUPER, not Google's slug (MESITA-1695): fifteen switches (twelve since MESITA-2486) in Google's
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
] as const;
export type SuperParamKey = (typeof SUPER_PARAM_KEYS)[number];

/** Mirrors AREA_SOURCE_KEYS / AREA_SOURCE_DEFAULT in
 *  _shared/discovery-config.ts (MESITA-2703): each source is off (0) or on
 *  (20). The Google two bill one Nearby call each per load. */
export const AREA_SOURCE_KEYS = [
  "googlePopular",
  "googleClosest",
  "mesitaPopular",
  "mesitaClosest",
] as const;
export type AreaSourceKey = (typeof AREA_SOURCE_KEYS)[number];
export const AREA_SOURCE_ON = 20;
/** Mirrors MAP_RADIUS_KM_* in _shared/discovery-config.ts. Max = Google's Nearby circle cap. */
export const MAP_RADIUS_KM_MIN = 1;
export const MAP_RADIUS_KM_MAX = 50;
const MAP_RADIUS_KM_DEFAULT = 15;
/** Mirrors MAP_PROXIMITY_WEIGHT_* in _shared/discovery-config.ts. */
export const MAP_PROXIMITY_WEIGHT_MIN = 0;
export const MAP_PROXIMITY_WEIGHT_MAX = 5;
const MAP_PROXIMITY_WEIGHT_DEFAULT = 1;
/** Mirrors MAP_RELOAD_IDLE_SEC_* in _shared/discovery-config.ts. */
export const MAP_RELOAD_IDLE_SEC_MIN = 0.5;
export const MAP_RELOAD_IDLE_SEC_MAX = 10;
const MAP_RELOAD_IDLE_SEC_DEFAULT = 1.5;
/** The reviews floor's ceiling, `map.googleMinReviews`. */
export const GENERAL_MIN_REVIEWS_MAX = 100_000;

export type MapConfig = {
  minRating: number;
  minReviews: number;
  minPopularity: number;
  /** The Map reloads when it rests, at most once every this many seconds
   *  (MESITA-2444). */
  reloadIdleSec: number;
  /** The four Area sources (MESITA-2703), 0 or 20 each, Home and the Map. */
  googlePopular: number;
  googleClosest: number;
  mesitaPopular: number;
  mesitaClosest: number;
  /** The current-location radius (km): Home's from the device or a saved
   *  pin with no radius, the Map's with no screen, Chat's (MESITA-2703). */
  radiusKm: number;
  /** THE Google reviews floor (MESITA-2319), Google rows only, on the Map,
   *  Home and the Name pipeline (one floor since MESITA-2702). 0 = off. */
  googleMinReviews: number;
  /** Proximity's exponent a in Proximity^a × Popularity^b. */
  proximityWeight: number;
  /** Popularity's exponent b (MESITA-2703). */
  popularityWeight: number;
};

/**
 * The seven params the operator actually sees. `label` and `emoji` are
 * verbatim from FAMILIES in _shared/place-taxonomy.ts; `battery` is
 * the Google slugs that family sends — its full list since MESITA-2438,
 * copied from `GOOGLE_SEARCH_TYPES` and pinned equal by
 * `supabase/…/_shared/admin-battery-mirror.test.ts` — shown read-only so
 * the box says what it bills without asking anyone to toggle Google's
 * vocabulary.
 */
export const SUPER_FIELDS: {
  key: SuperParamKey;
  label: string;
  emoji: string;
  battery: readonly string[];
}[] = [
  {
    key: "coffee",
    label: "Coffee",
    emoji: "☕",
    battery: [
      "cafe",
      "cat_cafe",
      "coffee_roastery",
      "coffee_shop",
      "coffee_stand",
      "dog_cafe",
      "juice_shop",
      "tea_house",
    ],
  },
  {
    key: "breakfast",
    label: "Breakfast",
    emoji: "🥐",
    battery: [
      "breakfast_restaurant",
      "bagel_shop",
      "brunch_restaurant",
      "diner",
      "bakery",
      "cafe",
      "cat_cafe",
      "coffee_shop",
      "dog_cafe",
      "donut_shop",
      "pastry_shop",
    ],
  },
  {
    key: "quick_bite",
    label: "Quick bite",
    emoji: "🥙",
    battery: [
      "fast_food_restaurant",
      "deli",
      "falafel_restaurant",
      "food_court",
      "gyro_restaurant",
      "hot_dog_restaurant",
      "hot_dog_stand",
      "kebab_shop",
      "meal_takeaway",
      "salad_shop",
      "sandwich_shop",
      "shawarma_restaurant",
      "snack_bar",
    ],
  },
  {
    key: "pizza",
    label: "Pizza",
    emoji: "🍕",
    battery: [
      "pizza_restaurant",
      "pizza_delivery",
    ],
  },
  {
    key: "tacos",
    label: "Tacos",
    emoji: "🌮",
    battery: [
      "mexican_restaurant",
      "burrito_restaurant",
      "taco_restaurant",
      "tex_mex_restaurant",
    ],
  },
  {
    key: "sushi",
    label: "Sushi",
    emoji: "🍣",
    battery: [
      "sushi_restaurant",
      "japanese_restaurant",
    ],
  },
  {
    key: "burgers",
    label: "Burgers",
    emoji: "🍔",
    battery: [
      "hamburger_restaurant",
    ],
  },
  {
    key: "noodles",
    label: "Noodles",
    emoji: "🍜",
    battery: [
      "ramen_restaurant",
      "chinese_noodle_restaurant",
      "dumpling_restaurant",
      "noodle_shop",
    ],
  },
  {
    key: "dinner",
    label: "Dinner",
    emoji: "🍝",
    battery: [
      "restaurant",
      "afghani_restaurant",
      "african_restaurant",
      "american_restaurant",
      "argentinian_restaurant",
      "asian_fusion_restaurant",
      "asian_restaurant",
      "australian_restaurant",
      "austrian_restaurant",
      "bangladeshi_restaurant",
      "barbecue_restaurant",
      "basque_restaurant",
      "bavarian_restaurant",
      "belgian_restaurant",
      "bistro",
      "brazilian_restaurant",
      "british_restaurant",
      "buffet_restaurant",
      "burmese_restaurant",
      "cajun_restaurant",
      "californian_restaurant",
      "cambodian_restaurant",
      "cantonese_restaurant",
      "caribbean_restaurant",
      "chicken_restaurant",
      "chicken_wings_restaurant",
      "chilean_restaurant",
      "chinese_restaurant",
      "colombian_restaurant",
      "croatian_restaurant",
      "cuban_restaurant",
      "czech_restaurant",
      "danish_restaurant",
      "dim_sum_restaurant",
      "dutch_restaurant",
      "eastern_european_restaurant",
      "ethiopian_restaurant",
      "european_restaurant",
      "family_restaurant",
      "filipino_restaurant",
      "fine_dining_restaurant",
      "fish_and_chips_restaurant",
      "fondue_restaurant",
      "french_restaurant",
      "fusion_restaurant",
      "german_restaurant",
      "greek_restaurant",
      "halal_restaurant",
      "hawaiian_restaurant",
      "hot_pot_restaurant",
    ],
  },
  {
    key: "sweet",
    label: "Sweet",
    emoji: "🍰",
    battery: [
      "bakery",
      "acai_shop",
      "cake_shop",
      "candy_store",
      "chocolate_factory",
      "chocolate_shop",
      "confectionery",
      "dessert_restaurant",
      "dessert_shop",
      "donut_shop",
      "ice_cream_shop",
      "pastry_shop",
    ],
  },
  {
    key: "drinks",
    label: "Drinks",
    emoji: "🍸",
    battery: [
      "bar",
      "bar_and_grill",
      "beer_garden",
      "brewery",
      "brewpub",
      "cocktail_bar",
      "gastropub",
      "hookah_bar",
      "irish_pub",
      "japanese_izakaya_restaurant",
      "lounge_bar",
      "pub",
      "sports_bar",
      "vineyard",
      "wine_bar",
      "winery",
    ],
  },
  {
    key: "night_out",
    label: "Night out",
    emoji: "🌙",
    battery: [
      "night_club",
      "comedy_club",
      "dance_hall",
      "karaoke",
      "live_music_venue",
    ],
  },
];

/** Google stars top out at 5: the ceiling of `map.minRating`. */
export const MIN_RATING_MAX = 5;
const CATALOG_COUNT_MAX = 20;
const CATALOG_PLACES_PER_RAIL_MIN = 4;
const CATALOG_PLACES_PER_RAIL_MAX = 20;
const CATALOG_MIN_SEED_PLACES_MAX = 20;
const MAP_MIN_POPULARITY_MAX = 1;
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
};

export const DEFAULT_MAP: MapConfig = {
  minRating: 0,
  minReviews: 0,
  minPopularity: 0,
  reloadIdleSec: MAP_RELOAD_IDLE_SEC_DEFAULT,
  googlePopular: AREA_SOURCE_ON,
  googleClosest: AREA_SOURCE_ON,
  mesitaPopular: AREA_SOURCE_ON,
  mesitaClosest: AREA_SOURCE_ON,
  radiusKm: MAP_RADIUS_KM_DEFAULT,
  googleMinReviews: 0,
  proximityWeight: MAP_PROXIMITY_WEIGHT_DEFAULT,
  popularityWeight: MAP_PROXIMITY_WEIGHT_DEFAULT,
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
};

/** Mirrors DEFAULT_SIGNAL_PARAMS. */
const DEFAULT_SIGNAL_PARAMS: SignalParams = {
  popularity: { halfReviews: 100 },
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
 * The Area pipeline's numbers. Mirrors `normalizeSignalParams`: rebuilt
 * field by field, so the retired deck's bags (maxKm, timing, category,
 * priorRating, …), the retired calibration (halfDistanceKm,
 * referenceRating/Reviews, MESITA-2347), the linear `balance`
 * (MESITA-2428), the weights table `modes` (MESITA-2687), `proximity` and
 * `selected` (MESITA-2703) are dropped on the next Save.
 */
function coerceParams(raw: unknown): SignalParams {
  const r = (raw ?? {}) as Record<string, unknown>;
  const pop = (r.popularity ?? {}) as Record<string, unknown>;
  const d = DEFAULT_SIGNAL_PARAMS;
  return {
    popularity: {
      halfReviews: bounded(pop.halfReviews, d.popularity.halfReviews, HALF_REVIEWS_MIN, HALF_REVIEWS_MAX, 0),
    },
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

/** An Area source switch: 0 or 20, snapped. Mirrors normalizeAreaSource. */
function coerceAreaSource(raw: unknown): number {
  const n = num(raw, AREA_SOURCE_ON, 0, AREA_SOURCE_ON);
  return n >= AREA_SOURCE_ON / 2 ? AREA_SOURCE_ON : 0;
}

/** Billed Nearby calls per load: one per Google source switched on. */
export function googleCallsPerLoad(map: Pick<MapConfig, AreaSourceKey>): number {
  return (map.googlePopular > 0 ? 1 : 0) + (map.googleClosest > 0 ? 1 : 0);
}

function coerceGeneral(raw: unknown): GeneralConfig {
  const g = (raw ?? {}) as Record<string, unknown>;
  return {
    requireActive:
      typeof g.requireActive === "boolean"
        ? g.requireActive
        : DEFAULT_GENERAL.requireActive,
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
  return {
    minRating: Math.round(
      num(m.minRating, DEFAULT_MAP.minRating, 0, MIN_RATING_MAX) * 10,
    ) / 10,
    minReviews: Math.round(num(m.minReviews, DEFAULT_MAP.minReviews, 0, 100_000)),
    minPopularity: Math.round(
      num(m.minPopularity, DEFAULT_MAP.minPopularity, 0, MAP_MIN_POPULARITY_MAX) * 100,
    ) / 100,
    reloadIdleSec:
      Math.round(
        num(m.reloadIdleSec, DEFAULT_MAP.reloadIdleSec, MAP_RELOAD_IDLE_SEC_MIN, MAP_RELOAD_IDLE_SEC_MAX) * 100,
      ) / 100,
    // Rebuilt key by key: a retired key (`googlePull`, `pinCount`, `supers`,
    // the reload km/sec pair, the 20/40/60 stops, `googleFill`) is dropped
    // on the next save.
    googlePopular: coerceAreaSource(m.googlePopular),
    googleClosest: coerceAreaSource(m.googleClosest),
    mesitaPopular: coerceAreaSource(m.mesitaPopular),
    mesitaClosest: coerceAreaSource(m.mesitaClosest),
    radiusKm:
      Math.round(
        num(m.radiusKm, DEFAULT_MAP.radiusKm, MAP_RADIUS_KM_MIN, MAP_RADIUS_KM_MAX) * 10,
      ) / 10,
    googleMinReviews: Math.round(
      num(m.googleMinReviews, DEFAULT_MAP.googleMinReviews, 0, 100_000),
    ),
    proximityWeight:
      Math.round(
        num(
          m.proximityWeight,
          DEFAULT_MAP.proximityWeight,
          MAP_PROXIMITY_WEIGHT_MIN,
          MAP_PROXIMITY_WEIGHT_MAX,
        ) * 100,
      ) / 100,
    popularityWeight:
      Math.round(
        num(
          m.popularityWeight,
          DEFAULT_MAP.popularityWeight,
          MAP_PROXIMITY_WEIGHT_MIN,
          MAP_PROXIMITY_WEIGHT_MAX,
        ) * 100,
      ) / 100,
  };
}
