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
 * The Area pipeline's two stored signal numbers: Proximity's radius divisor
 * (half credit at radius ÷ k, MESITA-2720) and Popularity's reviews for half
 * credit. The exponents live on `map`. Mirrors SignalParams in
 * _shared/discovery-config.ts.
 */
export type SignalParams = {
  /** The Distance penalty: the Map, Home and Chat alike (MESITA-2776). */
  proximity: { radiusDivisor: number };
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
  // `minReviews` retired (MESITA-2702), `map.googleMinReviews` too (MESITA-2721).
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

/** Mirrors the Proximity bounds in _shared/pipeline-signals.ts (MESITA-2720). */
export const RADIUS_DIVISOR_MIN = 0.1;
export const RADIUS_DIVISOR_MAX = 10;
/** Mirrors the Popularity bounds in _shared/pipeline-signals.ts. */
export const HALF_REVIEWS_MIN = 1;
export const HALF_REVIEWS_MAX = 100_000;

export type CatalogConfig = {
  seedCount: number;
  generatedCount: number;
  placesPerRail: number;
  minSeedPlaces: number;
};

// Mirrors SUPER_PARAM_KEYS in _shared/discovery-config.ts, itself pinned to
// the taxonomy by google-type-super.test.ts. The operator's category param is
// the family, not Google's slug (MESITA-1695). Order is the guest's —
// FAMILIES sort_order. Fifty switches since MESITA-2834 (twenty from
// MESITA-2749 to 2760).
export const SUPER_PARAM_KEYS = [
  "coffee",
  "breakfast",
  "brunch",
  "bakery",
  "sweet",
  "gelato",
  "healthy",
  "vegan",
  "quick_bite",
  "tacos",
  "burgers",
  "pizza",
  "sandwiches",
  "chicken",
  "wings",
  "kebab",
  "dinner",
  "mexican",
  "steak",
  "bbq",
  "seafood",
  "italian",
  "sushi",
  "japanese",
  "ramen",
  "noodles",
  "chinese",
  "dumplings",
  "korean",
  "thai",
  "indian",
  "asian",
  "arabic",
  "mediterranean",
  "spanish",
  "french",
  "european",
  "american",
  "latin",
  "fancy",
  "drinks",
  "beer",
  "cocktails",
  "wine",
  "sports",
  "hookah",
  "night_out",
  "nightclub",
  "music",
  "karaoke",
] as const;
export type SuperParamKey = (typeof SUPER_PARAM_KEYS)[number];

/** Mirrors AREA_SOURCE_KEYS / AREA_SOURCE_DEFAULT in
 *  _shared/discovery-config.ts (MESITA-2703): each source is off (0) or on
 *  (20). Google Nearby's two retired in MESITA-2872. */
export const AREA_SOURCE_KEYS = [
  "mesitaPopular",
  "mesitaClosest",
] as const;
export type AreaSourceKey = (typeof AREA_SOURCE_KEYS)[number];
export const AREA_SOURCE_ON = 20;
/** Mirrors MAP_RADIUS_KM_* in _shared/discovery-config.ts. */
export const MAP_RADIUS_KM_MIN = 1;
export const MAP_RADIUS_KM_MAX = 50;
const MAP_RADIUS_KM_DEFAULT = 15;
/** Mirrors MAP_PLACES_SHOWN_* in _shared/discovery-config.ts (MESITA-2713). */
export const MAP_PLACES_SHOWN_MIN = 1;
export const MAP_PLACES_SHOWN_MAX = 40;
const MAP_PLACES_SHOWN_DEFAULT = 20;
/** Mirrors MAP_POPULARITY_FLOOR_* in _shared/discovery-config.ts (MESITA-2714). */
export const MAP_POPULARITY_FLOOR_MIN = 0;
export const MAP_POPULARITY_FLOOR_MAX = 20;
const MAP_POPULARITY_FLOOR_DEFAULT = 3;
/** Mirrors MAP_SELECTED_FACTOR_* in _shared/discovery-config.ts (MESITA-2717). */
export const MAP_SELECTED_FACTOR_MIN = 1;
export const MAP_SELECTED_FACTOR_MAX = 10;
const MAP_SELECTED_FACTOR_DEFAULT = 3;
/** Mirrors MAP_RELOAD_IDLE_SEC_* in _shared/discovery-config.ts. */
export const MAP_RELOAD_IDLE_SEC_MIN = 0.5;
export const MAP_RELOAD_IDLE_SEC_MAX = 10;
const MAP_RELOAD_IDLE_SEC_DEFAULT = 1.5;
/** Mirrors MAP_RELOAD_MIN_VIEWPORT_PCT_* in _shared/discovery-config.ts (MESITA-2732). */
export const MAP_RELOAD_MIN_VIEWPORT_PCT_MIN = 0;
export const MAP_RELOAD_MIN_VIEWPORT_PCT_MAX = 50;
const MAP_RELOAD_MIN_VIEWPORT_PCT_DEFAULT = 15;

export type MapConfig = {
  minRating: number;
  minReviews: number;
  minPopularity: number;
  /** The Map reloads when it rests, at most once every this many seconds
   *  (MESITA-2444). */
  reloadIdleSec: number;
  /** Min share of the last-reload screen a guest move must cover before
   *  rest-reload (MESITA-2732). 0 = any move. */
  reloadMinViewportPct: number;
  /** The two Area sources (MESITA-2703, Mesita only since MESITA-2872), 0
   *  or 20 each, Home and the Map. */
  mesitaPopular: number;
  mesitaClosest: number;
  /** The current-location radius (km): Home's from the device or a saved
   *  pin with no radius, the Map's with no screen, Chat's (MESITA-2703). */
  radiusKm: number;
  // `proximityWeight` / `popularityWeight` retired (MESITA-2722).
  /** How many sorted places the Map shows, 1..40 (MESITA-2713). */
  placesShown: number;
  /** The same for Home, total across its rails; missing = the Map's (MESITA-2727). */
  catalogPlacesShown: number;
  /** The Popularity floor, ln units, 0..20, default 3; 0 = off (MESITA-2714). */
  popularityFloor: number;
  /** A Mesita Selected place's score × this, every other place's × 1;
   *  1..10, default 3; 1 = off (MESITA-2717). */
  selectedFactor: number;
};

/**
 * The fifty params the operator actually sees. `label` and `emoji` are
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
    emoji: "🍳",
    battery: [
      "breakfast_restaurant",
      "bagel_shop",
      "bakery",
      "brunch_restaurant",
      "cafe",
      "coffee_shop",
      "diner",
      "donut_shop",
      "pastry_shop",
    ],
  },
  {
    key: "brunch",
    label: "Brunch",
    emoji: "🥞",
    battery: [
      "brunch_restaurant",
      "breakfast_restaurant",
      "cafe",
    ],
  },
  {
    key: "bakery",
    label: "Bakery",
    emoji: "🥐",
    battery: [
      "bakery",
      "bagel_shop",
      "cake_shop",
      "donut_shop",
      "pastry_shop",
    ],
  },
  {
    key: "sweet",
    label: "Dessert",
    emoji: "🍰",
    battery: [
      "dessert_shop",
      "acai_shop",
      "bakery",
      "cake_shop",
      "candy_store",
      "chocolate_factory",
      "chocolate_shop",
      "confectionery",
      "dessert_restaurant",
      "donut_shop",
      "ice_cream_shop",
      "pastry_shop",
    ],
  },
  {
    key: "gelato",
    label: "Gelato",
    emoji: "🍦",
    battery: [
      "ice_cream_shop",
      "acai_shop",
    ],
  },
  {
    key: "healthy",
    label: "Healthy",
    emoji: "🥗",
    battery: [
      "salad_shop",
      "acai_shop",
      "juice_shop",
      "vegan_restaurant",
      "vegetarian_restaurant",
    ],
  },
  {
    key: "vegan",
    label: "Vegan",
    emoji: "🌱",
    battery: [
      "vegan_restaurant",
      "vegetarian_restaurant",
    ],
  },
  {
    key: "quick_bite",
    label: "Quick",
    emoji: "⚡",
    battery: [
      "fast_food_restaurant",
      "burrito_restaurant",
      "chicken_restaurant",
      "deli",
      "falafel_restaurant",
      "fish_and_chips_restaurant",
      "food_court",
      "gyro_restaurant",
      "hamburger_restaurant",
      "hot_dog_restaurant",
      "hot_dog_stand",
      "kebab_shop",
      "meal_takeaway",
      "pizza_delivery",
      "salad_shop",
      "sandwich_shop",
      "shawarma_restaurant",
      "snack_bar",
      "taco_restaurant",
    ],
  },
  {
    key: "tacos",
    label: "Tacos",
    emoji: "🌮",
    battery: [
      "taco_restaurant",
      "burrito_restaurant",
      "mexican_restaurant",
      "tex_mex_restaurant",
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
    key: "pizza",
    label: "Pizza",
    emoji: "🍕",
    battery: [
      "pizza_restaurant",
      "pizza_delivery",
    ],
  },
  {
    key: "sandwiches",
    label: "Sandwich",
    emoji: "🥪",
    battery: [
      "sandwich_shop",
      "bagel_shop",
      "deli",
    ],
  },
  {
    key: "chicken",
    label: "Chicken",
    emoji: "🍗",
    battery: [
      "chicken_restaurant",
      "chicken_wings_restaurant",
    ],
  },
  {
    key: "wings",
    label: "Wings",
    emoji: "🔥",
    battery: [
      "chicken_wings_restaurant",
    ],
  },
  {
    key: "kebab",
    label: "Kebab",
    emoji: "🥙",
    battery: [
      "kebab_shop",
      "falafel_restaurant",
      "gyro_restaurant",
      "shawarma_restaurant",
      "turkish_restaurant",
    ],
  },
  {
    key: "dinner",
    label: "Dinner",
    emoji: "🍽️",
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
      "bar_and_grill",
      "barbecue_restaurant",
      "basque_restaurant",
      "bavarian_restaurant",
      "belgian_restaurant",
      "bistro",
      "brazilian_restaurant",
      "brewpub",
      "british_restaurant",
      "buffet_restaurant",
      "burmese_restaurant",
      "cajun_restaurant",
      "californian_restaurant",
      "cambodian_restaurant",
      "cantonese_restaurant",
      "caribbean_restaurant",
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
      "fondue_restaurant",
      "french_restaurant",
      "fusion_restaurant",
      "gastropub",
      "german_restaurant",
      "greek_restaurant",
      "halal_restaurant",
      "hamburger_restaurant",
      "hawaiian_restaurant",
    ],
  },
  {
    key: "mexican",
    label: "Mexican",
    emoji: "🌶️",
    battery: [
      "mexican_restaurant",
      "burrito_restaurant",
      "taco_restaurant",
      "tex_mex_restaurant",
    ],
  },
  {
    key: "steak",
    label: "Steak",
    emoji: "🥩",
    battery: [
      "steak_house",
      "argentinian_restaurant",
      "barbecue_restaurant",
      "brazilian_restaurant",
    ],
  },
  {
    key: "bbq",
    label: "BBQ",
    emoji: "🍖",
    battery: [
      "barbecue_restaurant",
      "korean_barbecue_restaurant",
      "mongolian_barbecue_restaurant",
      "yakiniku_restaurant",
    ],
  },
  {
    key: "seafood",
    label: "Seafood",
    emoji: "🦐",
    battery: [
      "seafood_restaurant",
      "fish_and_chips_restaurant",
      "oyster_bar_restaurant",
      "peruvian_restaurant",
    ],
  },
  {
    key: "italian",
    label: "Italian",
    emoji: "🍝",
    battery: [
      "italian_restaurant",
      "pizza_restaurant",
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
    key: "japanese",
    label: "Japanese",
    emoji: "🍱",
    battery: [
      "japanese_restaurant",
      "japanese_curry_restaurant",
      "japanese_izakaya_restaurant",
      "ramen_restaurant",
      "sushi_restaurant",
      "tonkatsu_restaurant",
      "yakiniku_restaurant",
      "yakitori_restaurant",
    ],
  },
  {
    key: "ramen",
    label: "Ramen",
    emoji: "🍜",
    battery: [
      "ramen_restaurant",
    ],
  },
  {
    key: "noodles",
    label: "Noodles",
    emoji: "🥢",
    battery: [
      "noodle_shop",
      "chinese_noodle_restaurant",
      "ramen_restaurant",
      "vietnamese_restaurant",
    ],
  },
  {
    key: "chinese",
    label: "Chinese",
    emoji: "🥡",
    battery: [
      "chinese_restaurant",
      "cantonese_restaurant",
      "chinese_noodle_restaurant",
      "dim_sum_restaurant",
      "dumpling_restaurant",
      "hot_pot_restaurant",
      "taiwanese_restaurant",
    ],
  },
  {
    key: "dumplings",
    label: "Dumpling",
    emoji: "🥟",
    battery: [
      "dumpling_restaurant",
      "cantonese_restaurant",
      "dim_sum_restaurant",
    ],
  },
  {
    key: "korean",
    label: "Korean",
    emoji: "🍚",
    battery: [
      "korean_restaurant",
      "korean_barbecue_restaurant",
    ],
  },
  {
    key: "thai",
    label: "Thai",
    emoji: "🍲",
    battery: [
      "thai_restaurant",
    ],
  },
  {
    key: "indian",
    label: "Indian",
    emoji: "🍛",
    battery: [
      "indian_restaurant",
      "bangladeshi_restaurant",
      "north_indian_restaurant",
      "pakistani_restaurant",
      "south_indian_restaurant",
      "sri_lankan_restaurant",
    ],
  },
  {
    key: "asian",
    label: "Asian",
    emoji: "🍥",
    battery: [
      "asian_restaurant",
      "asian_fusion_restaurant",
      "burmese_restaurant",
      "cambodian_restaurant",
      "filipino_restaurant",
      "indonesian_restaurant",
      "malaysian_restaurant",
      "mongolian_barbecue_restaurant",
      "noodle_shop",
      "taiwanese_restaurant",
      "tibetan_restaurant",
      "vietnamese_restaurant",
    ],
  },
  {
    key: "arabic",
    label: "Arabic",
    emoji: "🧆",
    battery: [
      "lebanese_restaurant",
      "falafel_restaurant",
      "halal_restaurant",
      "kebab_shop",
      "middle_eastern_restaurant",
      "moroccan_restaurant",
      "persian_restaurant",
      "shawarma_restaurant",
    ],
  },
  {
    key: "mediterranean",
    label: "Greek",
    emoji: "🫒",
    battery: [
      "mediterranean_restaurant",
      "greek_restaurant",
      "israeli_restaurant",
      "lebanese_restaurant",
      "middle_eastern_restaurant",
      "moroccan_restaurant",
      "turkish_restaurant",
    ],
  },
  {
    key: "spanish",
    label: "Spanish",
    emoji: "🥘",
    battery: [
      "spanish_restaurant",
      "basque_restaurant",
      "tapas_restaurant",
    ],
  },
  {
    key: "french",
    label: "French",
    emoji: "🥖",
    battery: [
      "french_restaurant",
      "bistro",
    ],
  },
  {
    key: "european",
    label: "European",
    emoji: "🥨",
    battery: [
      "european_restaurant",
      "austrian_restaurant",
      "bavarian_restaurant",
      "belgian_restaurant",
      "british_restaurant",
      "croatian_restaurant",
      "czech_restaurant",
      "danish_restaurant",
      "dutch_restaurant",
      "eastern_european_restaurant",
      "fondue_restaurant",
      "german_restaurant",
      "hungarian_restaurant",
      "irish_restaurant",
      "polish_restaurant",
      "portuguese_restaurant",
      "romanian_restaurant",
      "russian_restaurant",
      "scandinavian_restaurant",
      "swiss_restaurant",
      "ukrainian_restaurant",
    ],
  },
  {
    key: "american",
    label: "American",
    emoji: "🍟",
    battery: [
      "american_restaurant",
      "bar_and_grill",
      "cajun_restaurant",
      "californian_restaurant",
      "diner",
      "hamburger_restaurant",
      "hawaiian_restaurant",
      "soul_food_restaurant",
      "southwestern_us_restaurant",
    ],
  },
  {
    key: "latin",
    label: "Latin",
    emoji: "🌎",
    battery: [
      "latin_american_restaurant",
      "argentinian_restaurant",
      "brazilian_restaurant",
      "caribbean_restaurant",
      "chilean_restaurant",
      "colombian_restaurant",
      "cuban_restaurant",
      "peruvian_restaurant",
      "south_american_restaurant",
    ],
  },
  {
    key: "fancy",
    label: "Fancy",
    emoji: "🥂",
    battery: [
      "fine_dining_restaurant",
    ],
  },
  {
    key: "drinks",
    label: "Bar",
    emoji: "🍻",
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
      "wine_bar",
    ],
  },
  {
    key: "beer",
    label: "Beer",
    emoji: "🍺",
    battery: [
      "brewery",
      "bavarian_restaurant",
      "beer_garden",
      "brewpub",
      "czech_restaurant",
      "gastropub",
      "german_restaurant",
      "irish_pub",
      "pub",
      "sports_bar",
    ],
  },
  {
    key: "cocktails",
    label: "Cocktail",
    emoji: "🍸",
    battery: [
      "cocktail_bar",
      "lounge_bar",
    ],
  },
  {
    key: "wine",
    label: "Wine",
    emoji: "🍷",
    battery: [
      "wine_bar",
      "vineyard",
      "winery",
    ],
  },
  {
    key: "sports",
    label: "Sports",
    emoji: "📺",
    battery: [
      "sports_bar",
    ],
  },
  {
    key: "hookah",
    label: "Hookah",
    emoji: "💨",
    battery: [
      "hookah_bar",
    ],
  },
  {
    key: "night_out",
    label: "Night",
    emoji: "🌙",
    battery: [
      "dance_hall",
      "cocktail_bar",
      "comedy_club",
      "hookah_bar",
      "karaoke",
      "live_music_venue",
      "lounge_bar",
      "night_club",
    ],
  },
  {
    key: "nightclub",
    label: "Club",
    emoji: "🪩",
    battery: [
      "night_club",
      "dance_hall",
    ],
  },
  {
    key: "music",
    label: "Music",
    emoji: "🎶",
    battery: [
      "live_music_venue",
      "dance_hall",
    ],
  },
  {
    key: "karaoke",
    label: "Karaoke",
    emoji: "🎤",
    battery: [
      "karaoke",
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
/** Name lane caps. */
export const NAME_LANE_COUNT_MAX = 20;
const NAME_FAST_COUNT_DEFAULT = 5;
const NAME_MESITA_COUNT_DEFAULT = 3;
const NAME_GOOGLE_COUNT_DEFAULT = 3;

/** Mirrors CHAT_PROMPT_MAX in _shared/discovery-config.ts. */
const CHAT_PROMPT_MAX = 12_000;

export const DEFAULT_CATALOG: CatalogConfig = {
  seedCount: 8,
  generatedCount: 8,
  placesPerRail: 8,
  minSeedPlaces: 2,
};

// Coffee, Dinner, Dessert, Bar and Night default on, every other
// family off (MESITA-2749; the thirty of MESITA-2834 joined off). The
// switches gate no call today: every family's battery rides the
// all-families Nearby call. Mirrors DEFAULT_MAP_SUPERS in
// _shared/discovery-config.ts.
const DEFAULT_MAP_SUPERS: Record<SuperParamKey, boolean> = {
  coffee: true,
  breakfast: false,
  brunch: false,
  bakery: false,
  sweet: true,
  gelato: false,
  healthy: false,
  vegan: false,
  quick_bite: false,
  tacos: false,
  burgers: false,
  pizza: false,
  sandwiches: false,
  chicken: false,
  wings: false,
  kebab: false,
  dinner: true,
  mexican: false,
  steak: false,
  bbq: false,
  seafood: false,
  italian: false,
  sushi: false,
  japanese: false,
  ramen: false,
  noodles: false,
  chinese: false,
  dumplings: false,
  korean: false,
  thai: false,
  indian: false,
  asian: false,
  arabic: false,
  mediterranean: false,
  spanish: false,
  french: false,
  european: false,
  american: false,
  latin: false,
  fancy: false,
  drinks: true,
  beer: false,
  cocktails: false,
  wine: false,
  sports: false,
  hookah: false,
  night_out: true,
  nightclub: false,
  music: false,
  karaoke: false,
};

export const DEFAULT_MAP: MapConfig = {
  minRating: 0,
  minReviews: 0,
  minPopularity: 0,
  reloadIdleSec: MAP_RELOAD_IDLE_SEC_DEFAULT,
  reloadMinViewportPct: MAP_RELOAD_MIN_VIEWPORT_PCT_DEFAULT,
  mesitaPopular: AREA_SOURCE_ON,
  mesitaClosest: AREA_SOURCE_ON,
  radiusKm: MAP_RADIUS_KM_DEFAULT,
  placesShown: MAP_PLACES_SHOWN_DEFAULT,
  catalogPlacesShown: MAP_PLACES_SHOWN_DEFAULT,
  popularityFloor: MAP_POPULARITY_FLOOR_DEFAULT,
  selectedFactor: MAP_SELECTED_FACTOR_DEFAULT,
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
  proximity: { radiusDivisor: 2 },
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
 * (MESITA-2428), the weights table `modes` (MESITA-2687), `proximity.reachKm`
 * and `selected` (MESITA-2703) are dropped on the next Save;
 * `proximity.radiusDivisor` (the Distance penalty, MESITA-2720; the Map,
 * Home and Chat alike since MESITA-2776) is the one proximity field; the
 * fixed `halfKm` (MESITA-2706) and `catalogRadiusDivisor` drop.
 */
function coerceParams(raw: unknown): SignalParams {
  const r = (raw ?? {}) as Record<string, unknown>;
  const prox = (r.proximity ?? {}) as Record<string, unknown>;
  const pop = (r.popularity ?? {}) as Record<string, unknown>;
  const d = DEFAULT_SIGNAL_PARAMS;
  return {
    proximity: {
      radiusDivisor: bounded(prox.radiusDivisor, d.proximity.radiusDivisor, RADIUS_DIVISOR_MIN, RADIUS_DIVISOR_MAX, 1),
    },
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
  const placesShown = Math.round(
    num(m.placesShown, DEFAULT_MAP.placesShown, MAP_PLACES_SHOWN_MIN, MAP_PLACES_SHOWN_MAX),
  );
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
    reloadMinViewportPct:
      Math.round(
        num(
          m.reloadMinViewportPct,
          DEFAULT_MAP.reloadMinViewportPct,
          MAP_RELOAD_MIN_VIEWPORT_PCT_MIN,
          MAP_RELOAD_MIN_VIEWPORT_PCT_MAX,
        ) * 10,
      ) / 10,
    // Rebuilt key by key: a retired key (`googlePull`, `pinCount`, `supers`,
    // the reload km/sec pair, the 20/40/60 stops, `googleFill`, the Google
    // sources `googlePopular` / `googleClosest`) is dropped on the next save.
    mesitaPopular: coerceAreaSource(m.mesitaPopular),
    mesitaClosest: coerceAreaSource(m.mesitaClosest),
    radiusKm:
      Math.round(
        num(m.radiusKm, DEFAULT_MAP.radiusKm, MAP_RADIUS_KM_MIN, MAP_RADIUS_KM_MAX) * 10,
      ) / 10,
    placesShown,
    catalogPlacesShown: Math.round(
      num(m.catalogPlacesShown, placesShown, MAP_PLACES_SHOWN_MIN, MAP_PLACES_SHOWN_MAX),
    ),
    popularityFloor:
      Math.round(
        num(m.popularityFloor, DEFAULT_MAP.popularityFloor, MAP_POPULARITY_FLOOR_MIN, MAP_POPULARITY_FLOOR_MAX) * 10,
      ) / 10,
    selectedFactor:
      Math.round(
        num(m.selectedFactor, DEFAULT_MAP.selectedFactor, MAP_SELECTED_FACTOR_MIN, MAP_SELECTED_FACTOR_MAX) * 10,
      ) / 10,
  };
}
