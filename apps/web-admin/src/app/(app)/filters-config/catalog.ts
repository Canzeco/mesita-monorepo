// Discovery config — the console's twin of `_shared/discovery-config.ts`.
//
// Live HTML: ONE page of cards (MESITA-2327; five since MESITA-4454). Source,
// pipeline, signal and gate facts live in discovery-surface.ts, a tested copy
// of the Edge Function model. Family membership stays on Atlas.
//
// `coerceConfig` mirrors `normalizeDiscoveryConfig` key for key. Under
// `params` and `map` it spreads the raw object and overlays the typed keys
// (H-2, MESITA-4454), so a key this build does not know (a newer build's, or
// a retired one waiting for its migration) survives a read and a Save. The
// EF twin's discovery-config.test.ts reads this file to pin it.
//
// RETIRED WITH THE SWIPE DECK (MESITA-2328): `weights`, `weightsByMode`,
// `engines`, the `swipe` slice and the deck's numbers on `params`. They are
// dropped on the next Save, never renamed.
//
// RETIRED WITH LIST-PLACES' LISTED LANES (MESITA-2337): the operator
// `filters`. Nothing read them once those lanes went; dropped on the next
// Save, like the deck's keys.

import { num } from "@/lib/config-coerce";

/** Home's three modes (MESITA-4454): chip Nearby (`near`), Popular (`all`),
 *  any family chip. Mirrors RankMode in _shared/pipeline-signals.ts. */
export type RankMode = "nearby" | "popular" | "family";

/** One recipe row (MESITA-4454). `halfKm` and `distanceExp` are null on the
 *  Map's rows (no Proximity there); `premierExp` is 0 on every Organic row.
 *  Mirrors Recipe in _shared/pipeline-signals.ts. */
export type Recipe = {
  halfKm: number | null;
  distanceExp: number | null;
  googleExp: number;
  foursquareFactor: number;
  foursquareExponent: number;
  premierExp: number;
  /** A Catalog lane's batch per weave (MESITA-4517); null on the Map. */
  batch: number | null;
};

/** The rows (MESITA-4548: every lane Organic + Inorganic), Catalog modes × lanes plus the Map's two. Mirrors
 *  RECIPE_ROWS in _shared/discovery-config.ts. */
export const RECIPE_ROWS = [
  "catalogNearbyOrganic",
  "catalogNearbyInorganic",
  "catalogNearbyBoth",
  "catalogNearbyBothInorganic",
  "catalogFamilyClose",
  "catalogFamilyCloseInorganic",
  "catalogFamilyWellKnown",
  "catalogFamilyWellKnownInorganic",
  "catalogFamilyBoth",
  "catalogFamilyBothInorganic",
  "catalogPopularOrganic",
  "catalogPopularInorganic",
  "catalogPopularBoth",
  "catalogPopularBothInorganic",
  "mapOrganic",
  "mapInorganic",
] as const;
export type RecipeRow = (typeof RECIPE_ROWS)[number];
export type Recipes = Record<RecipeRow, Recipe>;

/** `params.mix`: per-mode Temperature, the ad floor, the ad cadence. */
export type MixParams = {
  temperature: Record<RankMode, number>;
  adFloor: number;
  adEvery: number;
  /** Growth's share of Popularity after 30 days of review history. 0.50 at launch. */
  growthWeightCap: number;
};

/** Every row but "…Inorganic" is organic (Family close, well known and
 *  both, MESITA-4517). */
export const isOrganicRow = (row: RecipeRow) => !row.endsWith("Inorganic");
export const isMapRow = (row: RecipeRow) => row.startsWith("map");

/**
 * The stored signal numbers (MESITA-3083): Proximity's half distance (km)
 * and exponent (the Catalog pipeline and Chat, MESITA-2909) and
 * Popularity's root (the Map, the Catalog and Chat). Mirrors SignalParams
 * in _shared/discovery-config.ts. `halfReviews` retired with MESITA-3083.
 */
export type SignalParams = {
  /** Proximity is 1 ÷ (1 + (d ÷ D)^e): ½ at D km whatever e is
   *  (MESITA-3015); e = 1 is the plain reciprocal (MESITA-3083). */
  proximity: { halfKm: number; exponent: number };
  /** Popularity is (1 + reviews × stars)^root; 0.33 is the cube root.
   *  `starsPower`: × (stars ÷ 5)^k on the Catalog and Chat (MESITA-4153). */
  popularity: { root: number; starsPower: number };
  /** Home's shuffle after the sort; 0 = none (MESITA-4153). UNREAD since
   *  MESITA-4454 (`mix.temperature` per mode replaces it); kept until the
   *  follow-up migration deletes it. `proximity` and `popularity` likewise. */
  shuffle: { temperature: number };
  /** The eight recipe rows (MESITA-4454): the Ranking card. */
  recipes: Recipes;
  /** Home's mix (MESITA-4454): the Mixing card. */
  mix: MixParams;
};

export type NameFastConfig = {
  /** Redundant with count on Fast — one source. Locked together. */
  googleCount: number;
  count: number;
};

export type NameDeepConfig = {
  /** Google Autocomplete cap. Independent query. */
  autoCount: number;
  /** Google Text Search cap. Independent query. */
  googleCount: number;
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
  /** Minimum Popularity (MESITA-2714; Name-only since MESITA-3086): the
   *  guest bar sorts Google places under it last, read at the Catalog root.
   *  0..20, one decimal, default 2.7; 0 = off. */
  popularityFloor: number;
};

export type NameAdminConfig = {
  autoCount: number;
  textCount: number;
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

/** Mirrors PremierConfig in _shared/discovery-config.ts (MESITA-3043):
 *  each plan's yearly price, whole US cents; plans are sold yearly only
 *  (MESITA-3285). */
export type PremierTier = "boost_2x" | "boost_5x";
export type PremierConfig = { yearlyCents: Record<PremierTier, number> };
export const PREMIER_TIERS: readonly PremierTier[] = ["boost_2x", "boost_5x"];
/** Mirrors PREMIER_YEARLY_CENTS_* in _shared/discovery-config.ts. */
export const PREMIER_YEARLY_CENTS_MIN = 100;
export const PREMIER_YEARLY_CENTS_MAX = 10_000_000;
/** Mirrors PREMIER_YEARLY_CENTS in _shared/boost.ts (Pro $99, Max $999 a year). */
export const DEFAULT_PREMIER: PremierConfig = { yearlyCents: { boost_2x: 9900, boost_5x: 99900 } };

export type DiscoveryConfig = {
  params: SignalParams;
  general: GeneralConfig;
  map: MapConfig;
  name: NameConfig;
  deep: DeepConfig;
  chat: { prompt: string };
  premier: PremierConfig;
};

/** Mirrors DeepConfig in _shared/discovery-config.ts (MESITA-2327). */
export type DeepConfig = { limit: number; minSimilarity: number };
export const DEEP_LIMIT_MIN = 1;
export const DEEP_LIMIT_MAX = 20;
export const DEFAULT_DEEP: DeepConfig = { limit: 5, minSimilarity: 0 };

/** Mirrors the Proximity bounds in _shared/pipeline-signals.ts (MESITA-3015, MESITA-3083). */
export const HALF_KM_MIN = 0.1;
export const HALF_KM_MAX = 100;
export const EXPONENT_MIN = 0.5;
export const EXPONENT_MAX = 5;
/** Mirrors the Popularity root bounds in _shared/pipeline-signals.ts (MESITA-3083). */
export const POPULARITY_ROOT_MIN = 0.1;
export const POPULARITY_ROOT_MAX = 1;
/** Mirrors STARS_POWER_* and SHUFFLE_TEMPERATURE_* in
 *  _shared/pipeline-signals.ts (MESITA-4153). */
export const STARS_POWER_MIN = 0;
export const STARS_POWER_MAX = 12;
export const SHUFFLE_TEMPERATURE_MIN = 0;
export const SHUFFLE_TEMPERATURE_MAX = 5;
/** Mirrors the recipe and mix bounds in _shared/pipeline-signals.ts
 *  (MESITA-4454). Half distance and Distance exponent are HALF_KM_* and
 *  EXPONENT_*. */
export const GOOGLE_EXP_MIN = 0.1;
export const GOOGLE_EXP_MAX = 1;
export const PREMIER_EXP_MIN = 0;
export const PREMIER_EXP_MAX = 2;
export const FOURSQUARE_FACTOR_MIN = 0;
export const FOURSQUARE_FACTOR_MAX = 5;
export const FOURSQUARE_EXPONENT_MIN = 1;
export const FOURSQUARE_EXPONENT_MAX = 40;
export const LANE_BATCH_MIN = 1;
export const LANE_BATCH_MAX = 25;
export const MIX_TEMPERATURE_MIN = 0;
export const MIX_TEMPERATURE_MAX = 5;
export const AD_FLOOR_MIN = 0;
export const AD_FLOOR_MAX = 1;
export const AD_EVERY_MIN = 0;
export const AD_EVERY_MAX = 10;
export const GROWTH_WEIGHT_CAP_MIN = 0;
export const GROWTH_WEIGHT_CAP_MAX = 0.8;

/** Mirrors RECIPE_BOUNDS and MIX_BOUNDS in _shared/discovery-config.ts. */
export const RECIPE_BOUNDS = {
  halfKm: { min: HALF_KM_MIN, max: HALF_KM_MAX, decimals: 2 },
  distanceExp: { min: EXPONENT_MIN, max: EXPONENT_MAX, decimals: 1 },
  googleExp: { min: GOOGLE_EXP_MIN, max: GOOGLE_EXP_MAX, decimals: 2 },
  foursquareFactor: { min: FOURSQUARE_FACTOR_MIN, max: FOURSQUARE_FACTOR_MAX, decimals: 2 },
  foursquareExponent: { min: FOURSQUARE_EXPONENT_MIN, max: FOURSQUARE_EXPONENT_MAX, decimals: 0 },
  premierExp: { min: PREMIER_EXP_MIN, max: PREMIER_EXP_MAX, decimals: 1 },
  batch: { min: LANE_BATCH_MIN, max: LANE_BATCH_MAX, decimals: 0 },
} as const;

export const MIX_BOUNDS = {
  temperature: { min: MIX_TEMPERATURE_MIN, max: MIX_TEMPERATURE_MAX, decimals: 2 },
  adFloor: { min: AD_FLOOR_MIN, max: AD_FLOOR_MAX, decimals: 2 },
  adEvery: { min: AD_EVERY_MIN, max: AD_EVERY_MAX, decimals: 0 },
  growthWeightCap: { min: GROWTH_WEIGHT_CAP_MIN, max: GROWTH_WEIGHT_CAP_MAX, decimals: 2 },
} as const;

/** The recipe table (Pato, 2026-11-19). Mirrors DEFAULT_RECIPES. */
export const DEFAULT_RECIPES: Recipes = {
  catalogNearbyOrganic: { halfKm: 0.1, distanceExp: 4, googleExp: 0.33, foursquareFactor: 1, foursquareExponent: 20, premierExp: 0, batch: 10 },
  catalogNearbyInorganic: { halfKm: 0.5, distanceExp: 2, googleExp: 0.17, foursquareFactor: 1, foursquareExponent: 20, premierExp: 1, batch: 10 },
  // MESITA-4548: Nearby both copies Nearby close; each new Inorganic row
  // copies its feed's Inorganic row.
  catalogNearbyBoth: { halfKm: 0.1, distanceExp: 4, googleExp: 0.33, foursquareFactor: 1, foursquareExponent: 20, premierExp: 0, batch: 10 },
  catalogNearbyBothInorganic: { halfKm: 0.5, distanceExp: 2, googleExp: 0.17, foursquareFactor: 1, foursquareExponent: 20, premierExp: 1, batch: 10 },
  // MESITA-4517: close copies Nearby Organic, well known copies Popular
  // Organic, both keeps the old Family Organic knobs.
  catalogFamilyClose: { halfKm: 0.1, distanceExp: 4, googleExp: 0.33, foursquareFactor: 1, foursquareExponent: 20, premierExp: 0, batch: 10 },
  catalogFamilyCloseInorganic: { halfKm: 2, distanceExp: 2, googleExp: 0.17, foursquareFactor: 1, foursquareExponent: 20, premierExp: 1, batch: 10 },
  catalogFamilyWellKnown: { halfKm: 10, distanceExp: 2, googleExp: 0.33, foursquareFactor: 1, foursquareExponent: 20, premierExp: 0, batch: 10 },
  catalogFamilyWellKnownInorganic: { halfKm: 2, distanceExp: 2, googleExp: 0.17, foursquareFactor: 1, foursquareExponent: 20, premierExp: 1, batch: 10 },
  catalogFamilyBoth: { halfKm: 2, distanceExp: 2, googleExp: 0.33, foursquareFactor: 1, foursquareExponent: 20, premierExp: 0, batch: 10 },
  catalogFamilyBothInorganic: { halfKm: 2, distanceExp: 2, googleExp: 0.17, foursquareFactor: 1, foursquareExponent: 20, premierExp: 1, batch: 10 },
  catalogPopularOrganic: { halfKm: 10, distanceExp: 2, googleExp: 0.33, foursquareFactor: 1, foursquareExponent: 20, premierExp: 0, batch: 10 },
  catalogPopularInorganic: { halfKm: 10, distanceExp: 2, googleExp: 0.17, foursquareFactor: 1, foursquareExponent: 20, premierExp: 1, batch: 10 },
  catalogPopularBoth: { halfKm: 10, distanceExp: 2, googleExp: 0.33, foursquareFactor: 1, foursquareExponent: 20, premierExp: 0, batch: 10 },
  catalogPopularBothInorganic: { halfKm: 10, distanceExp: 2, googleExp: 0.17, foursquareFactor: 1, foursquareExponent: 20, premierExp: 1, batch: 10 },
  mapOrganic: { halfKm: null, distanceExp: null, googleExp: 0.33, foursquareFactor: 1, foursquareExponent: 20, premierExp: 0, batch: null },
  mapInorganic: { halfKm: null, distanceExp: null, googleExp: 0.17, foursquareFactor: 1, foursquareExponent: 20, premierExp: 1, batch: null },
};

/** Mirrors DEFAULT_MIX. */
export const DEFAULT_MIX: MixParams = {
  temperature: { nearby: 0.33, family: 0.5, popular: 1 },
  adFloor: 0.2,
  adEvery: 1,
  growthWeightCap: 0.5,
};

/** Mirrors MAP_PLACES_SHOWN_* in _shared/discovery-config.ts (MESITA-2713, MESITA-2909). */
export const MAP_PLACES_SHOWN_MIN = 1;
export const MAP_PLACES_SHOWN_MAX = 200;
const MAP_PLACES_SHOWN_DEFAULT = 50;
/** Mirrors MAP_DOTS_SHOWN_* in _shared/discovery-config.ts (MESITA-3980). */
export const MAP_DOTS_SHOWN_MIN = 0;
export const MAP_DOTS_SHOWN_MAX = 1000;
const MAP_DOTS_SHOWN_DEFAULT = 200;
/** Mirrors CATALOG_PAGE_SIZE_* in _shared/discovery-config.ts (MESITA-2909). */
export const CATALOG_PAGE_SIZE_MIN = 5;
export const CATALOG_PAGE_SIZE_MAX = 100;
const CATALOG_PAGE_SIZE_DEFAULT = 20;
/** Mirrors NAME_POPULARITY_FLOOR_* in _shared/discovery-config.ts (MESITA-2714;
 *  root units since MESITA-3083; on Name since MESITA-3086). */
export const NAME_POPULARITY_FLOOR_MIN = 0;
export const NAME_POPULARITY_FLOOR_MAX = 20;
const NAME_POPULARITY_FLOOR_DEFAULT = 2.7;
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
  // The source switches `mesitaPopular` / `mesitaClosest` retired (MESITA-2909).
  // `radiusKm` retired (MESITA-3086): the Map's radius is the screen's.
  /** The Map's Popularity root (MESITA-3086): on the Map it only sets how
   *  much a Premier plan outweighs reviews. 0.1..1, two decimals, default 0.33. */
  popularityRoot: number;
  // `proximityWeight` / `popularityWeight` retired (MESITA-2722).
  /** The Map's most pins, 1..200, default 50 (MESITA-2713, MESITA-2909). */
  placesShown: number;
  /** The Map's marks in all, 0..1000, default 200 (MESITA-3980): the top
   *  `placesShown` are pins with cards, the rest up to this many small dots. */
  dotsShown: number;
  /** Home's Catalog page size, 5..100, default 20 (MESITA-2909; it
   *  replaced `catalogPlacesShown`). */
  catalogPageSize: number;
  // `popularityFloor` moved to `name.popularityFloor` (MESITA-3086).
  // `selectedFactor` (the Selected boost) retired with Selected (MESITA-2925):
  // Premier's factor is the paid tier, no knob; the next Save drops it.
};

/** Google stars top out at 5: the ceiling of `map.minRating`. */
export const MIN_RATING_MAX = 5;
const MAP_MIN_POPULARITY_MAX = 1;
/** Name lane caps. */
export const NAME_LANE_COUNT_MAX = 20;
const NAME_FAST_COUNT_DEFAULT = 5;
const NAME_GOOGLE_COUNT_DEFAULT = 3;

/** Mirrors CHAT_PROMPT_MAX in _shared/discovery-config.ts. */
const CHAT_PROMPT_MAX = 12_000;

export const DEFAULT_MAP: MapConfig = {
  minRating: 0,
  minReviews: 0,
  minPopularity: 0,
  reloadIdleSec: MAP_RELOAD_IDLE_SEC_DEFAULT,
  reloadMinViewportPct: MAP_RELOAD_MIN_VIEWPORT_PCT_DEFAULT,
  popularityRoot: 0.33,
  placesShown: MAP_PLACES_SHOWN_DEFAULT,
  dotsShown: MAP_DOTS_SHOWN_DEFAULT,
  catalogPageSize: CATALOG_PAGE_SIZE_DEFAULT,
};

const DEFAULT_NAME_FAST: NameFastConfig = {
  googleCount: NAME_FAST_COUNT_DEFAULT,
  count: NAME_FAST_COUNT_DEFAULT,
};

const DEFAULT_NAME_DEEP: NameDeepConfig = {
  autoCount: NAME_GOOGLE_COUNT_DEFAULT,
  googleCount: NAME_GOOGLE_COUNT_DEFAULT,
};

/** Mirrors NAME_IDLE_SEC_* / NAME_ADMIN_* in _shared/discovery-config.ts. */
export const NAME_IDLE_SEC_MIN = 0.3;
export const NAME_IDLE_SEC_MAX = 5;
export const NAME_ADMIN_TEXT_MAX = 20;

export const DEFAULT_NAME_ADMIN: NameAdminConfig = {
  autoCount: 0,
  textCount: NAME_ADMIN_TEXT_MAX,
  emptyQuery: true,
};

export const DEFAULT_NAME: NameConfig = {
  fast: DEFAULT_NAME_FAST,
  deep: DEFAULT_NAME_DEEP,
  locations: true,
  idleSec: 1,
  admin: DEFAULT_NAME_ADMIN,
  popularityFloor: NAME_POPULARITY_FLOOR_DEFAULT,
};

export const DEFAULT_GENERAL: GeneralConfig = {
  requireActive: true,
};

/** Mirrors DEFAULT_SIGNAL_PARAMS. */
const DEFAULT_SIGNAL_PARAMS: SignalParams = {
  proximity: { halfKm: 1, exponent: 1 },
  popularity: { root: 0.33, starsPower: 6 },
  shuffle: { temperature: 0.3 },
  recipes: DEFAULT_RECIPES,
  mix: DEFAULT_MIX,
};

export const DEFAULT_CONFIG: DiscoveryConfig = {
  params: DEFAULT_SIGNAL_PARAMS,
  general: DEFAULT_GENERAL,
  map: DEFAULT_MAP,
  name: DEFAULT_NAME,
  deep: DEFAULT_DEEP,
  chat: { prompt: "" },
  premier: DEFAULT_PREMIER,
};

/** Round to the field's own decimals so a float cannot leave the page dirty. */
function bounded(raw: unknown, fallback: number, min: number, max: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(num(raw, fallback, min, max) * factor) / factor;
}

/** A plain object, else `{}`. Mirrors asRecord in _shared/config-coerce.ts. */
function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

/** One recipe or mix value. Mirrors `reportedParam`: absent, null, blank or
 *  not a number → the fallback; out of bounds → clamped; rounded to the
 *  field's decimals either way. */
function bounds(raw: unknown, fallback: number, b: { min: number; max: number; decimals: number }): number {
  const factor = 10 ** b.decimals;
  const n = typeof raw === "number" ? raw : raw === undefined || raw === null || raw === "" ? Number.NaN : Number(raw);
  const v = Number.isFinite(n) ? Math.min(b.max, Math.max(b.min, n)) : fallback;
  return Math.round(v * factor) / factor;
}

/** A row saved under an older key (MESITA-4517, MESITA-4548): Family Organic
 *  is Family both; the one Family Inorganic seeds all three Family Inorganic
 *  rows until the next save writes them. */
function legacyRow(row: RecipeRow, r: Record<string, unknown>): unknown {
  if (row === "catalogFamilyBoth") return r.catalogFamilyOrganic;
  if (
    row === "catalogFamilyCloseInorganic" || row === "catalogFamilyWellKnownInorganic" ||
    row === "catalogFamilyBothInorganic"
  ) return r.catalogFamilyInorganic;
  return undefined;
}

/** The recipe rows. Mirrors `normalizeRecipes`: a missing row or field
 *  reads the table; Map rows have no distance numbers (null); every Organic
 *  row's Premier exponent is 0 whatever is stored (C1, L-1). */
export function coerceRecipes(raw: unknown): Recipes {
  const r = asRecord(raw);
  const out = {} as Recipes;
  for (const row of RECIPE_ROWS) {
    const v = asRecord(r[row] !== undefined ? r[row] : legacyRow(row, r));
    const d = DEFAULT_RECIPES[row];
    const map = isMapRow(row);
    out[row] = {
      halfKm: map ? null : bounds(v.halfKm, d.halfKm as number, RECIPE_BOUNDS.halfKm),
      distanceExp: map ? null : bounds(v.distanceExp, d.distanceExp as number, RECIPE_BOUNDS.distanceExp),
      googleExp: bounds(v.googleExp, d.googleExp, RECIPE_BOUNDS.googleExp),
      foursquareFactor: bounds(v.foursquareFactor, d.foursquareFactor, RECIPE_BOUNDS.foursquareFactor),
      foursquareExponent: bounds(v.foursquareExponent, d.foursquareExponent, RECIPE_BOUNDS.foursquareExponent),
      premierExp: isOrganicRow(row) ? 0 : bounds(v.premierExp, d.premierExp, RECIPE_BOUNDS.premierExp),
      batch: map ? null : bounds(v.batch, d.batch as number, RECIPE_BOUNDS.batch),
    };
  }
  return out;
}

/** `params.mix`. Mirrors `normalizeMix`. */
export function coerceMix(raw: unknown): MixParams {
  const r = asRecord(raw);
  const t = asRecord(r.temperature);
  const temp = (mode: RankMode) => bounds(t[mode], DEFAULT_MIX.temperature[mode], MIX_BOUNDS.temperature);
  return {
    temperature: { nearby: temp("nearby"), family: temp("family"), popular: temp("popular") },
    adFloor: bounds(r.adFloor, DEFAULT_MIX.adFloor, MIX_BOUNDS.adFloor),
    adEvery: bounds(r.adEvery, DEFAULT_MIX.adEvery, MIX_BOUNDS.adEvery),
    growthWeightCap: bounds(r.growthWeightCap, DEFAULT_MIX.growthWeightCap, MIX_BOUNDS.growthWeightCap),
  };
}

/**
 * The signal numbers. Mirrors `normalizeSignalParams`: rebuilt
 * field by field, so the retired deck's bags (maxKm, timing, category,
 * priorRating, …), the retired calibration (halfDistanceKm,
 * referenceRating/Reviews, MESITA-2347), the linear `balance`
 * (MESITA-2428), the weights table `modes` (MESITA-2687), `proximity.reachKm`
 * and `selected` (MESITA-2703) are dropped on the next Save;
 * `proximity.halfKm` (the Catalog's half distance, MESITA-2909) and
 * `proximity.exponent` (MESITA-3083) are the proximity fields;
 * `radiusDivisor` (MESITA-2720) and `catalogRadiusDivisor` drop.
 * `popularity.root` is the one popularity field (MESITA-3083); the unread
 * `halfReviews` drops with it. A missing key reads its default.
 */
function coerceParams(raw: unknown): SignalParams {
  const r = (raw ?? {}) as Record<string, unknown>;
  const prox = (r.proximity ?? {}) as Record<string, unknown>;
  const pop = (r.popularity ?? {}) as Record<string, unknown>;
  const shuffle = (r.shuffle ?? {}) as Record<string, unknown>;
  const d = DEFAULT_SIGNAL_PARAMS;
  return {
    proximity: {
      halfKm: bounded(prox.halfKm, d.proximity.halfKm, HALF_KM_MIN, HALF_KM_MAX, 1),
      exponent: bounded(prox.exponent, d.proximity.exponent, EXPONENT_MIN, EXPONENT_MAX, 1),
    },
    popularity: {
      root: bounded(pop.root, d.popularity.root, POPULARITY_ROOT_MIN, POPULARITY_ROOT_MAX, 2),
      starsPower: bounded(pop.starsPower, d.popularity.starsPower, STARS_POWER_MIN, STARS_POWER_MAX, 1),
    },
    shuffle: {
      temperature: bounded(
        shuffle.temperature,
        d.shuffle.temperature,
        SHUFFLE_TEMPERATURE_MIN,
        SHUFFLE_TEMPERATURE_MAX,
        2,
      ),
    },
    recipes: coerceRecipes(r.recipes),
    mix: coerceMix(r.mix),
  };
}

/**
 * Tolerant read of whatever the EF returned, rebuilt key by key exactly like
 * `normalizeDiscoveryConfig`: a retired top-level key (`weights`,
 * `weightsByMode`, `engines`, `swipe`, MESITA-2328; `filters`, MESITA-2337)
 * is not carried into the next Save. Under `params` and `map` the raw object
 * is spread first and the typed keys overlaid (H-2, MESITA-4454): an unknown
 * key there is kept, never dropped by a Save.
 */
export function coerceConfig(raw: unknown): DiscoveryConfig {
  const r = asRecord(raw);

  return {
    params: { ...asRecord(r.params), ...coerceParams(r.params) },
    general: coerceGeneral(r.general),
    map: { ...asRecord(r.map), ...coerceMap(r.map) },
    name: coerceName(r.name),
    deep: coerceDeep(r.deep),
    chat: {
      prompt: typeof (r.chat as { prompt?: unknown } | undefined)?.prompt === "string"
        ? (r.chat as { prompt: string }).prompt.slice(0, CHAT_PROMPT_MAX)
        : DEFAULT_CONFIG.chat.prompt,
    },
    premier: coercePremier(r.premier),
  };
}

/** Mirrors `normalizePremierConfig`: whole cents, clamped, default per plan. */
function coercePremier(raw: unknown): PremierConfig {
  const m = ((raw ?? {}) as { yearlyCents?: Record<string, unknown> }).yearlyCents ?? {};
  const yearlyCents = {} as Record<PremierTier, number>;
  for (const tier of PREMIER_TIERS) {
    yearlyCents[tier] = Math.round(
      num(m[tier], DEFAULT_PREMIER.yearlyCents[tier], PREMIER_YEARLY_CENTS_MIN, PREMIER_YEARLY_CENTS_MAX),
    );
  }
  return { yearlyCents };
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
    },
    deep: {
      autoCount: Math.round(
        num(deep.autoCount, DEFAULT_NAME_DEEP.autoCount, 0, NAME_LANE_COUNT_MAX),
      ),
      googleCount: Math.round(
        num(deep.googleCount, DEFAULT_NAME_DEEP.googleCount, 0, NAME_LANE_COUNT_MAX),
      ),
    },
    locations: typeof n.locations === "boolean" ? n.locations : DEFAULT_NAME.locations,
    idleSec:
      Math.round(num(n.idleSec, DEFAULT_NAME.idleSec, NAME_IDLE_SEC_MIN, NAME_IDLE_SEC_MAX) * 10) /
      10,
    admin: coerceNameAdmin(n.admin),
    popularityFloor:
      Math.round(
        num(n.popularityFloor, DEFAULT_NAME.popularityFloor, NAME_POPULARITY_FLOOR_MIN, NAME_POPULARITY_FLOOR_MAX) * 10,
      ) / 10,
  };
}

function coerceNameAdmin(raw: unknown): NameAdminConfig {
  const a = (raw ?? {}) as Record<string, unknown>;
  return {
    autoCount: Math.round(num(a.autoCount, DEFAULT_NAME_ADMIN.autoCount, 0, NAME_LANE_COUNT_MAX)),
    textCount: Math.round(num(a.textCount, DEFAULT_NAME_ADMIN.textCount, 1, NAME_ADMIN_TEXT_MAX)),
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
    // the reload km/sec pair, the 20/40/60 stops, `googleFill`, the four
    // source switches, `catalogPlacesShown`, and since MESITA-3086 `radiusKm`
    // and `popularityFloor`) is dropped on the next save.
    popularityRoot:
      Math.round(
        num(m.popularityRoot, DEFAULT_MAP.popularityRoot, POPULARITY_ROOT_MIN, POPULARITY_ROOT_MAX) * 100,
      ) / 100,
    placesShown: Math.round(
      num(m.placesShown, DEFAULT_MAP.placesShown, MAP_PLACES_SHOWN_MIN, MAP_PLACES_SHOWN_MAX),
    ),
    dotsShown: Math.round(
      num(m.dotsShown, DEFAULT_MAP.dotsShown, MAP_DOTS_SHOWN_MIN, MAP_DOTS_SHOWN_MAX),
    ),
    catalogPageSize: Math.round(
      num(m.catalogPageSize, DEFAULT_MAP.catalogPageSize, CATALOG_PAGE_SIZE_MIN, CATALOG_PAGE_SIZE_MAX),
    ),
  };
}
