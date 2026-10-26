// Discovery config — the operator's half of the Discovery model (Docs ›
// Discovery, MESITA-2327).
//
// Keys: params · general · catalog · map · name · deep · chat.
// Admin: one page, four pipeline boxes (Name by Admin · Name · Area · Deep);
// each box saves only its own slices.
//
//   params     the Area pipeline's two half points: Proximity's distance for
//              half credit and Popularity's reviews for half credit
//              (pipeline-signals.ts). The Area box edits them.
//   general    Discovery-wide. requireActive — the post-Google wipe
//              (discovery-general-gate.ts). No reviews floor: the
//              Popularity floor is the quality cut (MESITA-2721). The category param is NOT
//              here: it is `supers` on each Google-calling engine (MESITA-1695).
//   chat       The Chat Agent's system prompt. Blank → memo_config, then the
//              in-code persona (memo-prompt.ts).
//
// RETIRED WITH THE SWIPE DECK (MESITA-2328): `weights`, `weightsByMode`,
// `engines`, the `swipe` slice and the deck's shape numbers on `params`. The
// normalizer rebuilds the blob key by key, so each one is dropped on the next
// save instead of lingering in jsonb. `swipe` was a persisted key: it is
// dropped, never renamed.
//
// RETIRED WITH LIST-PLACES' LISTED LANES (MESITA-2337): `filters`, the
// operator floor of the listed Mesita pool. Its last readers were the
// `{ lat, lng }` lane without `google: true` and the newest-first lane; the
// Area pipeline gates Selected itself (`selectedPoolQuery`).
//
// RETIRED AS UNREAD (MESITA-2687): `params.modes` (the weights table: no view
// read it after MESITA-2516, and its stored Nearby row ranked Chat by distance
// alone), `map.supers` (every guest family is on, `enabledMapSupers`) and
// `map.reloadMinKm` / `reloadMinSec` (the Map's distance gate, MESITA-2451).
//
// RETIRED WITH THE FOUR SOURCES (MESITA-2703): `map.googlePlaces`,
// `map.mapGooglePlaces`, `map.mesitaPlaces` (the 20/40/60 stops),
// `map.googleFill` (the two Google switches are Google's on/off),
// `params.proximity.reachKm` (the radius gates; the Proximity curve stopped
// reading it) and `params.selected` (the Area score is Proximity^a ×
// Popularity^b). Migration 20261023020000 strips them from the stored row.
// `params.proximity` came back with ONE field, `halfKm`, the reciprocal
// curve's distance for half credit (MESITA-2706); it became `radiusDivisor`,
// half credit at radius ÷ k (MESITA-2720), and a stored `halfKm` or
// `reachKm` is dropped on the next save.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { bool, num } from "./config-coerce.ts";
import {
  POPULARITY_HALF_REVIEWS_DEFAULT,
  POPULARITY_HALF_REVIEWS_MAX,
  POPULARITY_HALF_REVIEWS_MIN,
  PROXIMITY_RADIUS_DIVISOR_DEFAULT,
  PROXIMITY_RADIUS_DIVISOR_MAX,
  PROXIMITY_RADIUS_DIVISOR_MIN,
} from "./pipeline-signals.ts";

/**
 * The Area pipeline's two stored signal numbers: Proximity's radius divisor
 * (half credit at radius ÷ k, MESITA-2720) and Popularity's reviews for half
 * credit. There are no exponents (MESITA-2722 retired `map.proximityWeight`
 * and `map.popularityWeight`). The radius is the request's own: it gates, and it
 * sets the half distance through the divisor.
 */
export type SignalParams = {
  /** `radiusDivisor` is the Distance penalty: the Map, Home and Chat alike
   *  (MESITA-2776). */
  proximity: { radiusDivisor: number };
  popularity: { halfReviews: number };
};

export type CatalogConfig = {
  /** Atlas category rails that currently have inventory. */
  seedCount: number;
  /** Vibe-query rails, sampled from the code-defined bank (not Atlas slugs). */
  generatedCount: number;
  placesPerRail: number;
  /** Seed category must have at least this many listed places. */
  minSeedPlaces: number;
};

/**
 * The Deep pipeline (MESITA-2327): open-ended discovery over Mesita Places by
 * the Description signal, called by Chat. `limit` caps the places handed to
 * Chat; `minSimilarity` is a floor on the Description score (0 = off).
 */
export type DeepConfig = {
  limit: number;
  minSimilarity: number;
};

export const DEEP_LIMIT_MIN = 1;
export const DEEP_LIMIT_MAX = 20;
export const DEFAULT_DEEP: DeepConfig = { limit: 5, minSimilarity: 0 };

/**
 * THE OPERATOR'S CATEGORY PARAM (Pato, 2026-09-08, MESITA-1695): the twenty
 * guest families, in `FAMILIES` sort order — the same twenty, in the same
 * order, the guest sees as pills on the Filters sheet.
 *
 * Google's own type slugs are not a param. Twenty-two switches asked the
 * operator to think in Google's vocabulary, and the ordered "first N" cap on
 * top of them (`general.categoryCount`, now deleted) silently forced four
 * whole families off. One family on = its whole `GOOGLE_SEARCH_TYPES`
 * battery on.
 *
 * Super `undefined` is NOT here: its battery is empty, so a toggle for it
 * could never change a Google call. `google-type-super.test.ts` pins this list
 * to the taxonomy.
 */
export const SUPER_PARAM_KEYS = [
  "coffee",
  "breakfast",
  "quick_bite",
  "mexican",
  "pizza",
  "burgers",
  "chicken",
  "sushi",
  "noodles",
  "korean",
  "chinese",
  "italian",
  "seafood",
  "steak",
  "indian",
  "thai",
  "dinner",
  "sweet",
  "drinks",
  "night_out",
] as const;
export type SuperParamKey = (typeof SUPER_PARAM_KEYS)[number];

/**
 * The Area pipeline's policy (MESITA-2703): a point and a radius, FOUR
 * sources — Google Popularity, Google Proximity, Mesita Popularity, Mesita Proximity —
 * each 0 or 20 (`AREA_SOURCE_STOPS`), merged into one pool with duplicates
 * removed, then sorted by Proximity × Popularity × the Selected boost. Home and the Map read
 * the same switches. Operator numbers since MESITA-1699. Floors still
 * exclude; 0 = off.
 */
export type MapConfig = {
  minRating: number;
  minReviews: number;
  minPopularity: number;
  /**
   * The Map reloads when it comes to rest, at most once every this many
   * seconds counted from the last reload (MESITA-2440, MESITA-2451), sent by
   * consumer-web-list-places (MESITA-2444). `MAP_RELOAD_IDLE_SEC_MIN`..`MAX`
   * (the client's own clamp), two decimals, default 1.5.
   */
  reloadIdleSec: number;
  /**
   * Share of the screen at last reload the camera must move before an idle
   * reload fires (MESITA-2732). Pan as a fraction of that view, or a zoom
   * that scales it by that much. 0 = any guest move (MESITA-2451).
   * `MAP_RELOAD_MIN_VIEWPORT_PCT_MIN`..`MAX`, one decimal, default 15.
   */
  reloadMinViewportPct: number;
  /** Google Popularity: one billed Nearby call ranked POPULARITY over the whole
   *  circle. 0 or 20. */
  googlePopular: number;
  /** Google Proximity: one billed Nearby call ranked DISTANCE. 0 or 20. The
   *  reviews floor cuts its hits after Google bills them. */
  googleClosest: number;
  /** Mesita Popularity: the 20 Mesita rows in the circle with the highest raw
   *  Popularity. 0 or 20. Free. */
  mesitaPopular: number;
  /** Mesita Proximity: the 20 nearest Mesita rows in the circle. 0 or 20. */
  mesitaClosest: number;
  /**
   * THE CURRENT-LOCATION RADIUS (km): Home's radius when the guest searches
   * from the device or from a saved pin with no radius of its own, the Map's
   * when it has no screen to measure, and Chat's (MESITA-2703). A saved pin
   * carries its own radius. `MAP_RADIUS_KM_MIN`..`MAP_RADIUS_KM_MAX` — the
   * max is Google's Nearby circle cap (50 km). One decimal.
   */
  radiusKm: number;
  // `proximityWeight` and `popularityWeight` (the exponents a and b,
  // MESITA-2504/2703) retired in MESITA-2722: dropped on the next Save.
  /**
   * How many of the merged, sorted places the Map shows (Pato,
   * MESITA-2713): the top N of up to 80 (4 sources × 20).
   * `MAP_PLACES_SHOWN_MIN`..`MAX`, whole, default 20.
   */
  placesShown: number;
  /**
   * The same cut for Home's catalog (MESITA-2727), the total across its
   * rails. Same bounds; a blob without it reads `placesShown`.
   */
  catalogPlacesShown: number;
  /**
   * THE POPULARITY FLOOR (Pato, MESITA-2714: "if popularity score is below
   * 3 you cannot be shown … it doesn't matter what"): a place whose
   * Popularity, ln(1 + reviews × stars), is under it never shows on Home,
   * the Map or Chat, Google or Mesita. `MAP_POPULARITY_FLOOR_MIN`..`MAX`,
   * one decimal, default 3; 0 is off.
   */
  popularityFloor: number;
  /**
   * THE SELECTED BOOST (Pato, MESITA-2717: "if Select, then a factor to
   * multiply value of place. not select is 1, select is 3"; Admin's
   * "Selected factor" until MESITA-2722, the key never renamed): a Mesita
   * Selected place's Area score is multiplied by it, every other place's
   * by 1, and Mesita Popularity picks by Popularity × it.
   * `MAP_SELECTED_FACTOR_MIN`..`MAX`, one decimal, default 3; 1 is off.
   */
  selectedFactor: number;
};

/** The four Area sources, in the order the admin page lists them. */
export const AREA_SOURCE_KEYS = [
  "googlePopular",
  "googleClosest",
  "mesitaPopular",
  "mesitaClosest",
] as const;
export type AreaSourceKey = (typeof AREA_SOURCE_KEYS)[number];

/**
 * Name = two Search-bar boxes. Map Filters never cut this list.
 *   Fast  Autocomplete. googleCount + count (same cap — count is symmetry).
 *   Deep  Three query caps, then concat. Autocomplete → Text → Mesita
 *         Places. Overlaps drop. googleCount is Text Search.
 */
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
  /** Word's Locations (cities, regions) from Autocomplete, consumer bar
   *  only (MESITA-2319). The admin caller never shows them. */
  locations: boolean;
  /** Word is ONE search (MESITA-2322): the consumer bar runs Deep once the
   *  guest has stopped typing this many seconds. The EF returns it. */
  idleSec: number;
  /** Word by Admin: Single Place › Find's own caps (MESITA-2322). */
  admin: NameAdminConfig;
};

export type NameAdminConfig = {
  /** Autocomplete rows. 0 = Find does not call Autocomplete. */
  autoCount: number;
  /** Text Search rows (one page, at most 20). */
  textCount: number;
  /** Mesita name rows, at most 10. */
  mesitaCount: number;
  /** The page opens listing the Mesita catalogue, as an empty search. */
  emptyQuery: boolean;
};

/** Discovery-wide knobs. Only values that apply across engines belong here. */
export type GeneralConfig = {
  /**
   * Wipe out anything that is not Active. Active is the State-box fact:
   * `business_state === "OPERATIONAL"` on Mesita, Google's
   * `businessStatus` on a Google-only row. Unknown does not clear it — the
   * operator asked for only-active, and a place that cannot prove it is
   * open has not.
   */
  requireActive: boolean;
  // `minReviews` retired (MESITA-2702), and `map.googleMinReviews` with it
  // (MESITA-2721): both dropped on the next Save, never renamed.
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

/** Ceiling for discovery_config.chat.prompt. The console textarea matches it. */
export const CHAT_PROMPT_MAX = 12_000;

/** Google stars top out at 5: the ceiling of `map.minRating`. */
export const MIN_RATING_MAX = 5;

export const CATALOG_COUNT_MAX = 20;
export const CATALOG_PLACES_PER_RAIL_MIN = 4;
export const CATALOG_PLACES_PER_RAIL_MAX = 20;
export const CATALOG_MIN_SEED_PLACES_MAX = 20;
export const CATALOG_RAILS_CAP = 24;

export const MAP_MIN_POPULARITY_MAX = 1;

export const NAME_LANE_COUNT_MAX = 20;
export const NAME_FAST_COUNT_DEFAULT = 5;
export const NAME_MESITA_COUNT_DEFAULT = 3;
export const NAME_GOOGLE_COUNT_DEFAULT = 3;
/**
 * An Area source is off (0) or on (20): Nearby Search (New) hands back at
 * most 20 per call and has no pages, so 20 is one billed call per Google
 * source (MESITA-2703).
 */
export const AREA_SOURCE_STOPS = [0, 20] as const;
export const AREA_SOURCE_DEFAULT = 20;
/** `map.radiusKm` bounds. The max is Google's Nearby circle cap. */
export const MAP_RADIUS_KM_MIN = 1;
export const MAP_RADIUS_KM_MAX = 50;
export const MAP_RADIUS_KM_DEFAULT = 15;
/** `map.placesShown` bounds: at most the four sources' 80. */
export const MAP_PLACES_SHOWN_MIN = 1;
export const MAP_PLACES_SHOWN_MAX = 80;
export const MAP_PLACES_SHOWN_DEFAULT = 20;
/** `map.popularityFloor` bounds (ln units: 3 ≈ reviews × stars of 19). */
export const MAP_POPULARITY_FLOOR_MIN = 0;
export const MAP_POPULARITY_FLOOR_MAX = 20;
export const MAP_POPULARITY_FLOOR_DEFAULT = 3;
/** `map.selectedFactor` bounds: 1 leaves a Selected place's score alone. */
export const MAP_SELECTED_FACTOR_MIN = 1;
export const MAP_SELECTED_FACTOR_MAX = 10;
export const MAP_SELECTED_FACTOR_DEFAULT = 3;
/** The Map's reload throttle (s): the consumer clamps to the same 0.5–10. */
export const MAP_RELOAD_IDLE_SEC_MIN = 0.5;
export const MAP_RELOAD_IDLE_SEC_MAX = 10;
export const MAP_RELOAD_IDLE_SEC_DEFAULT = 1.5;
/** Min share of the last-reload screen a guest move must cover (MESITA-2732). */
export const MAP_RELOAD_MIN_VIEWPORT_PCT_MIN = 0;
export const MAP_RELOAD_MIN_VIEWPORT_PCT_MAX = 50;
export const MAP_RELOAD_MIN_VIEWPORT_PCT_DEFAULT = 15;

/**
 * Coffee, Dinner, Dessert, Drinks and Nightlife default on, every other
 * family off (MESITA-2749; Chicken and Korean joined off, MESITA-2760). The
 * switches gate no call today: `anySuperOn` returns true and
 * `enabledMapSupers` returns every key, so every family's battery rides the
 * all-families Nearby call.
 *
 * NOT for cost: one request carries the whole battery array (MESITA-1685).
 * Off by default because it keeps the returned pool as it was.
 */
export const DEFAULT_MAP_SUPERS: Record<SuperParamKey, boolean> = {
  coffee: true,
  breakfast: false,
  quick_bite: false,
  mexican: false,
  pizza: false,
  burgers: false,
  chicken: false,
  sushi: false,
  noodles: false,
  korean: false,
  chinese: false,
  italian: false,
  seafood: false,
  steak: false,
  indian: false,
  thai: false,
  dinner: true,
  sweet: true,
  drinks: true,
  night_out: true,
};

/** How many pins is the GUEST's question (How many, on the Filters sheet),
 *  never a knob here — the operator only decides IF Google may be called. */
export const DEFAULT_MAP: MapConfig = {
  minRating: 0,
  minReviews: 0,
  minPopularity: 0,
  reloadIdleSec: MAP_RELOAD_IDLE_SEC_DEFAULT,
  reloadMinViewportPct: MAP_RELOAD_MIN_VIEWPORT_PCT_DEFAULT,
  googlePopular: AREA_SOURCE_DEFAULT,
  googleClosest: AREA_SOURCE_DEFAULT,
  mesitaPopular: AREA_SOURCE_DEFAULT,
  mesitaClosest: AREA_SOURCE_DEFAULT,
  radiusKm: MAP_RADIUS_KM_DEFAULT,
  placesShown: MAP_PLACES_SHOWN_DEFAULT,
  catalogPlacesShown: MAP_PLACES_SHOWN_DEFAULT,
  popularityFloor: MAP_POPULARITY_FLOOR_DEFAULT,
  selectedFactor: MAP_SELECTED_FACTOR_DEFAULT,
};

export const DEFAULT_CATALOG: CatalogConfig = {
  seedCount: 8,
  generatedCount: 8,
  placesPerRail: 8,
  minSeedPlaces: 2,
};

export const DEFAULT_NAME_FAST: NameFastConfig = {
  googleCount: NAME_FAST_COUNT_DEFAULT,
  count: NAME_FAST_COUNT_DEFAULT,
  supers: DEFAULT_MAP_SUPERS,
};

export const DEFAULT_NAME_DEEP: NameDeepConfig = {
  mesitaCount: NAME_MESITA_COUNT_DEFAULT,
  autoCount: NAME_GOOGLE_COUNT_DEFAULT,
  googleCount: NAME_GOOGLE_COUNT_DEFAULT,
  supers: DEFAULT_MAP_SUPERS,
};

/** Word's idle bounds (seconds). */
export const NAME_IDLE_SEC_MIN = 0.3;
export const NAME_IDLE_SEC_MAX = 5;
export const NAME_ADMIN_TEXT_MAX = 20;
export const NAME_ADMIN_MESITA_MAX = 10;

/** Find's behaviour before these knobs existed: no Autocomplete, a Text
 *  Search page of 20, 10 Mesita names, the catalogue on an empty query. */
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
  // ON by default (Pato, 2026-08-29). A closed place is not a search
  // result, and the live blob predates the key — so the default is what
  // every surface reads until the operator says otherwise.
  requireActive: true,
};

/** The Area pipeline's numbers. A blob with no `params` reads these. */
export const DEFAULT_SIGNAL_PARAMS: SignalParams = {
  proximity: { radiusDivisor: PROXIMITY_RADIUS_DIVISOR_DEFAULT },
  popularity: { halfReviews: POPULARITY_HALF_REVIEWS_DEFAULT },
};

/** Legal ranges for the numbers the Area box edits. */
export const SIGNAL_PARAM_BOUNDS = {
  radiusDivisor: {
    min: PROXIMITY_RADIUS_DIVISOR_MIN,
    max: PROXIMITY_RADIUS_DIVISOR_MAX,
    decimals: 1,
  },
  halfReviews: {
    min: POPULARITY_HALF_REVIEWS_MIN,
    max: POPULARITY_HALF_REVIEWS_MAX,
    decimals: 0,
  },
} as const;

export const DISCOVERY_DEFAULTS: DiscoveryConfig = {
  params: DEFAULT_SIGNAL_PARAMS,
  general: DEFAULT_GENERAL,
  catalog: DEFAULT_CATALOG,
  map: DEFAULT_MAP,
  name: DEFAULT_NAME,
  deep: DEFAULT_DEEP,
  chat: { prompt: "" },
};

export function normalizeCatalogConfig(raw: unknown): CatalogConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const seedCount = Math.round(
    num(r.seedCount, DEFAULT_CATALOG.seedCount, 0, CATALOG_COUNT_MAX),
  );
  const generatedCount = Math.round(
    num(r.generatedCount, DEFAULT_CATALOG.generatedCount, 0, CATALOG_COUNT_MAX),
  );
  return {
    seedCount,
    generatedCount,
    placesPerRail: Math.round(
      num(
        r.placesPerRail,
        DEFAULT_CATALOG.placesPerRail,
        CATALOG_PLACES_PER_RAIL_MIN,
        CATALOG_PLACES_PER_RAIL_MAX,
      ),
    ),
    minSeedPlaces: Math.round(
      num(
        r.minSeedPlaces,
        DEFAULT_CATALOG.minSeedPlaces,
        1,
        CATALOG_MIN_SEED_PLACES_MAX,
      ),
    ),
  };
}

export function normalizeDeepConfig(raw: unknown): DeepConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    limit: Math.round(num(r.limit, DEFAULT_DEEP.limit, DEEP_LIMIT_MIN, DEEP_LIMIT_MAX)),
    minSimilarity: Math.round(num(r.minSimilarity, DEFAULT_DEEP.minSimilarity, 0, 1) * 100) / 100,
  };
}

export function normalizeChatPrompt(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.slice(0, CHAT_PROMPT_MAX);
}

/**
 * The seven Super params. A blob with no boolean Super key reads the defaults;
 * otherwise a missing or non-boolean key falls back to its own default.
 */
export function normalizeSuperParams(
  raw: unknown,
): Record<SuperParamKey, boolean> {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (!SUPER_PARAM_KEYS.some((key) => typeof r[key] === "boolean")) {
    return { ...DEFAULT_MAP_SUPERS };
  }
  const out = {} as Record<SuperParamKey, boolean>;
  for (const key of SUPER_PARAM_KEYS) {
    out[key] = bool(r[key], DEFAULT_MAP_SUPERS[key]);
  }
  return out;
}

/** An Area source switch: 0 or 20, snapped to the nearer stop. */
export function normalizeAreaSource(raw: unknown): number {
  const n = num(raw, AREA_SOURCE_DEFAULT, 0, AREA_SOURCE_DEFAULT);
  return n >= AREA_SOURCE_DEFAULT / 2 ? AREA_SOURCE_DEFAULT : 0;
}

export function normalizeGeneralConfig(raw: unknown): GeneralConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    requireActive: bool(r.requireActive, DEFAULT_GENERAL.requireActive),
  };
}

export function normalizeNameConfig(raw: unknown): NameConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const fast = (r.fast ?? {}) as Record<string, unknown>;
  const deep = (r.deep ?? {}) as Record<string, unknown>;
  const fastCount = Math.round(
    num(fast.count, DEFAULT_NAME_FAST.count, 0, NAME_LANE_COUNT_MAX),
  );
  return {
    fast: {
      googleCount: Math.round(
        num(
          fast.googleCount ?? fast.count,
          fastCount,
          0,
          NAME_LANE_COUNT_MAX,
        ),
      ),
      count: fastCount,
      supers: normalizeSuperParams(fast.supers),
    },
    deep: {
      mesitaCount: Math.round(
        num(
          deep.mesitaCount,
          DEFAULT_NAME_DEEP.mesitaCount,
          0,
          NAME_LANE_COUNT_MAX,
        ),
      ),
      autoCount: Math.round(
        num(
          deep.autoCount,
          DEFAULT_NAME_DEEP.autoCount,
          0,
          NAME_LANE_COUNT_MAX,
        ),
      ),
      googleCount: Math.round(
        num(
          deep.googleCount,
          DEFAULT_NAME_DEEP.googleCount,
          0,
          NAME_LANE_COUNT_MAX,
        ),
      ),
      supers: normalizeSuperParams(deep.supers),
    },
    locations: bool(r.locations, DEFAULT_NAME.locations),
    idleSec: Math.round(
      num(r.idleSec, DEFAULT_NAME.idleSec, NAME_IDLE_SEC_MIN, NAME_IDLE_SEC_MAX) * 10,
    ) / 10,
    admin: normalizeNameAdmin(r.admin),
  };
}

function normalizeNameAdmin(raw: unknown): NameAdminConfig {
  const a = (raw ?? {}) as Record<string, unknown>;
  return {
    autoCount: Math.round(
      num(a.autoCount, DEFAULT_NAME_ADMIN.autoCount, 0, NAME_LANE_COUNT_MAX),
    ),
    textCount: Math.round(
      num(a.textCount, DEFAULT_NAME_ADMIN.textCount, 1, NAME_ADMIN_TEXT_MAX),
    ),
    mesitaCount: Math.round(
      num(a.mesitaCount, DEFAULT_NAME_ADMIN.mesitaCount, 1, NAME_ADMIN_MESITA_MAX),
    ),
    emptyQuery: bool(a.emptyQuery, DEFAULT_NAME_ADMIN.emptyQuery),
  };
}

export function normalizeMapConfig(raw: unknown): MapConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const placesShown = Math.round(
    num(r.placesShown, DEFAULT_MAP.placesShown, MAP_PLACES_SHOWN_MIN, MAP_PLACES_SHOWN_MAX),
  );
  return {
    minRating: Math.round(
      num(r.minRating, DEFAULT_MAP.minRating, 0, MIN_RATING_MAX) * 10,
    ) / 10,
    minReviews: Math.round(
      num(r.minReviews, DEFAULT_MAP.minReviews, 0, 100_000),
    ),
    minPopularity: Math.round(
      num(
        r.minPopularity,
        DEFAULT_MAP.minPopularity,
        0,
        MAP_MIN_POPULARITY_MAX,
      ) * 100,
    ) / 100,
    reloadIdleSec: Math.round(
      num(
        r.reloadIdleSec,
        DEFAULT_MAP.reloadIdleSec,
        MAP_RELOAD_IDLE_SEC_MIN,
        MAP_RELOAD_IDLE_SEC_MAX,
      ) * 100,
    ) / 100,
    reloadMinViewportPct: Math.round(
      num(
        r.reloadMinViewportPct,
        DEFAULT_MAP.reloadMinViewportPct,
        MAP_RELOAD_MIN_VIEWPORT_PCT_MIN,
        MAP_RELOAD_MIN_VIEWPORT_PCT_MAX,
      ) * 10,
    ) / 10,
    // Rebuilt key by key: a retired key (`googlePull`, `pinCount`, `supers`,
    // the reload km/sec pair, the 20/40/60 stops, `googleFill`) is dropped
    // on the next save.
    googlePopular: normalizeAreaSource(r.googlePopular),
    googleClosest: normalizeAreaSource(r.googleClosest),
    mesitaPopular: normalizeAreaSource(r.mesitaPopular),
    mesitaClosest: normalizeAreaSource(r.mesitaClosest),
    radiusKm: Math.round(
      num(
        r.radiusKm,
        DEFAULT_MAP.radiusKm,
        MAP_RADIUS_KM_MIN,
        MAP_RADIUS_KM_MAX,
      ) * 10,
    ) / 10,
    placesShown,
    // Missing = the Map's count (MESITA-2727).
    catalogPlacesShown: Math.round(
      num(r.catalogPlacesShown, placesShown, MAP_PLACES_SHOWN_MIN, MAP_PLACES_SHOWN_MAX),
    ),
    popularityFloor: Math.round(
      num(
        r.popularityFloor,
        DEFAULT_MAP.popularityFloor,
        MAP_POPULARITY_FLOOR_MIN,
        MAP_POPULARITY_FLOOR_MAX,
      ) * 10,
    ) / 10,
    selectedFactor: Math.round(
      num(
        r.selectedFactor,
        DEFAULT_MAP.selectedFactor,
        MAP_SELECTED_FACTOR_MIN,
        MAP_SELECTED_FACTOR_MAX,
      ) * 10,
    ) / 10,
  };
}

/** Round to the field's own decimals so a float cannot leave the page dirty. */
function boundedParam(
  raw: unknown,
  fallback: number,
  b: { min: number; max: number; decimals: number },
): number {
  const factor = 10 ** b.decimals;
  return Math.round(num(raw, fallback, b.min, b.max) * factor) / factor;
}

/**
 * The Area pipeline's numbers. Rebuilt field by field, so a stored bag
 * from the retired deck (maxKm, kneeKm, timing, category, priorRating, …)
 * or the retired calibration (proximity.halfDistanceKm,
 * popularity.referenceRating/referenceReviews, MESITA-2347), the linear
 * `balance` (MESITA-2428), the weights table `modes` (MESITA-2687) or
 * `proximity.reachKm` / `selected` (MESITA-2703) is dropped on the next
 * save. `proximity.radiusDivisor` (the Distance penalty, MESITA-2720) is the
 * one proximity field read; the fixed `halfKm` (MESITA-2706) and Home's own
 * `catalogRadiusDivisor` (MESITA-2727, retired by MESITA-2776) drop.
 */
export function normalizeSignalParams(raw: unknown): SignalParams {
  const r = (raw ?? {}) as Record<string, unknown>;
  const prox = (r.proximity ?? {}) as Record<string, unknown>;
  const pop = (r.popularity ?? {}) as Record<string, unknown>;
  const d = DEFAULT_SIGNAL_PARAMS;
  return {
    proximity: {
      radiusDivisor: boundedParam(
        prox.radiusDivisor,
        d.proximity.radiusDivisor,
        SIGNAL_PARAM_BOUNDS.radiusDivisor,
      ),
    },
    popularity: {
      halfReviews: boundedParam(
        pop.halfReviews,
        d.popularity.halfReviews,
        SIGNAL_PARAM_BOUNDS.halfReviews,
      ),
    },
  };
}

/**
 * Tolerant read: any missing or invalid key falls back to its default, and
 * the blob is rebuilt key by key, so a retired key (`weights`,
 * `weightsByMode`, `engines`, `swipe`, MESITA-2328; `filters`, MESITA-2337)
 * is dropped on the next save rather than lingering in jsonb forever.
 */
export function normalizeDiscoveryConfig(raw: unknown): DiscoveryConfig {
  const r = (raw ?? {}) as Record<string, unknown>;

  return {
    params: normalizeSignalParams(r.params),
    general: normalizeGeneralConfig(r.general),
    catalog: normalizeCatalogConfig(r.catalog),
    map: normalizeMapConfig(r.map),
    name: normalizeNameConfig(r.name),
    deep: normalizeDeepConfig(r.deep),
    chat: {
      prompt: normalizeChatPrompt(
        ((r.chat ?? {}) as Record<string, unknown>).prompt,
      ),
    },
  };
}

/**
 * Load the live config, or the defaults if the row cannot be read.
 *
 * An engine must never fail to serve a deck because a config read failed —
 * falling back to defaults degrades the ordering, while throwing would empty
 * the guest's screen. The read error is logged, not raised.
 */
export async function loadDiscoveryConfig(
  admin: SupabaseClient,
): Promise<DiscoveryConfig> {
  try {
    const { data, error } = await admin
      .from("app_config")
      .select("discovery_config")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      console.error("[discovery-config] read:", error.message);
      return DISCOVERY_DEFAULTS;
    }
    return normalizeDiscoveryConfig(data?.discovery_config);
  } catch (e) {
    console.error("[discovery-config] read threw:", (e as Error).message);
    return DISCOVERY_DEFAULTS;
  }
}
