// Discovery config — the operator's half of the Discovery model (Docs ›
// Discovery, MESITA-2327).
//
// Keys: params · filters · general · catalog · map · name · deep · chat.
// Admin: one page, four pipeline boxes (Name by Admin · Name · Area · Deep);
// each box saves only its own slices.
//
//   params     the Area pipeline's calibration: Proximity's half distance
//              and Popularity's reference (pipeline-signals.ts). The Area box
//              edits all three numbers.
//   filters    what may ENTER the listed pool at all, pushed into the WHERE
//              clause (discovery-filters.ts). consumer-web-list-places still
//              reads it on its listed-nearby and newest-first lanes. No box
//              edits it; a whole-blob Save carries it through.
//   general    Discovery-wide. requireActive + minReviews — the post-Google
//              wipe (discovery-general-gate.ts). The category param is NOT
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
// FILTERS ARE NOT THE TORN-DOWN FILTER SURFACE. MESITA-1183 deleted a
// GUEST-facing one — "what may a guest exclude" — and that tombstone stands.
// These are OPERATOR pool policy: catalog-wide admission rules a guest never
// sees and cannot express. THIS BLOB DELIBERATELY DOES NOT INHERIT
// `filters_config`: that column was dropped in MESITA-1183 and its shape
// encoded the old six-filter-module model.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { bool, num } from "./config-coerce.ts";
import {
  POPULARITY_REFERENCE_RATING_DEFAULT,
  POPULARITY_REFERENCE_REVIEWS_DEFAULT,
  PROXIMITY_HALF_DISTANCE_KM_DEFAULT,
  PROXIMITY_HALF_DISTANCE_KM_MAX,
  PROXIMITY_HALF_DISTANCE_KM_MIN,
} from "./pipeline-signals.ts";

/**
 * The Area pipeline's calibration (MESITA-2327), the only numbers `params`
 * still carries. Both are provisional and await real traffic.
 */
export type SignalParams = {
  proximity: { halfDistanceKm: number };
  popularity: { referenceRating: number; referenceReviews: number };
};

export type CatalogConfig = {
  /** Atlas category rails that currently have inventory. */
  seedCount: number;
  /** Vibe-query rails, sampled from the code-defined bank (not Atlas slugs). */
  generatedCount: number;
  placesPerRail: number;
  /**
   * Places per Feed row (MESITA-2319): every rail, Google Places included.
   * A new key on purpose: the stored `placesPerRail` is a retired era's 8,
   * and reading it would have widened every rail past the 5 the Feed shows.
   */
  railCap: number;
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
 * Google Nearby primary types the map asks for. Off = absent from the
 * `includedPrimaryTypes` array, NOT a skipped call: `searchNearbyOnce`
 * (nearby-places.ts) sends ONE POST carrying every enabled type, and Google
 * Places Nearby (New) bills per REQUEST. Twenty-two types cost what five do.
 * These toggles shape one call's RESULT SET; they never change call count.
 *
 * ONE ENTRY PER TYPE IN `GOOGLE_SEARCH_TYPES`, in that object's own order, so
 * the strip covers all SEVEN Families rather than the three it knew
 * when it was five keys long (MESITA-1683). `google-type-super.test.ts` pins
 * this list to that map: the taxonomy is the law, this is its value today.
 *
 * THIS IS THE WIRE LIST, NOT THE PARAM. Since MESITA-1695 the operator toggles
 * SUPERS (`SUPER_PARAM_KEYS`) and the battery is derived by
 * `nearbyTypesForSupers`. Nothing reads this list positionally any more.
 */
export const NEARBY_TYPE_KEYS = [
  "cafe",
  "breakfast_restaurant",
  "fast_food_restaurant",
  "pizza_restaurant",
  "mexican_restaurant",
  "sushi_restaurant",
  "hamburger_restaurant",
  "ramen_restaurant",
  "restaurant",
  "bakery",
  "bar",
  "night_club",
  "tourist_attraction",
  "bowling_alley",
  "movie_theater",
  "gym",
  "fitness_center",
  "yoga_studio",
  "sports_club",
  "spa",
  "beauty_salon",
  "hair_salon",
  "massage",
] as const;
export type NearbyTypeKey = (typeof NEARBY_TYPE_KEYS)[number];

/**
 * THE OPERATOR'S CATEGORY PARAM (Pato, 2026-09-08, MESITA-1695): the fifteen
 * guest families, in `FAMILIES` sort order — the same fifteen, in the same
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

/**
 * Map pool policy. One Nearby Search (New) call inside `radiusKm`, the
 * nearest `pinCount` of the guest's one scope (Google Places or Mesita
 * Selected, MESITA-2298), then paint. Internally the three nested sets
 * (Google Places ⊃ Mesita Places ⊃ Mesita Enriched Places) still describe
 * the data; a guest never sees the middle ring or the word Enriched. N is
 * `pinCount`, an OPERATOR number since MESITA-1699 — the guest's Filters
 * sheet is gone and its controls live here and on Search Sources. Floors
 * still exclude; 0 = off.
 */
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
   * How many pins the map query returns: 20, 40 or 60 (`GOOGLE_PULL_STOPS`,
   * the same stops the guest used to pick).
   *
   * THIS WAS THE GUEST'S QUESTION UNTIL MESITA-1699. Pato: "remove filters
   * from search. like those filters are controlled in admin console, not in
   * consumer app." It caps the one scope's list, so max pins = pinCount.
   * Google itself returns at most 20 per Nearby call and the engine never
   * widens (MESITA-2298); 40 and 60 only matter for Mesita Selected.
   */
  pinCount: number;
  /**
   * THE ONE NEARBY RADIUS (km), shared by the Map and the Feed's Google
   * Places and Mesita Selected rails (MESITA-2298). The operator's number; a
   * guest never sets it. `MAP_RADIUS_KM_MIN`..`MAP_RADIUS_KM_MAX` — the max
   * is Google's Nearby circle cap (50 km). One decimal.
   */
  radiusKm: number;
  /**
   * The operator's Google reviews floor on GOOGLE HITS ONLY (MESITA-2319):
   * people, never stars, cut after Google answers, on the Map's Google scope
   * and the Feed's Google Places rail alike. The guest's own stop still
   * applies; the higher of the two wins. 0 is off. Never a Mesita floor.
   */
  googleMinReviews: number;
};

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
  /** Wipe out anything under this many Google reviews. 0 = off. */
  minReviews: number;
};

export type DiscoveryConfig = {
  params: SignalParams;
  filters: DiscoveryFilters;
  general: GeneralConfig;
  catalog: CatalogConfig;
  map: MapConfig;
  name: NameConfig;
  deep: DeepConfig;
  chat: { prompt: string };
};

/** Ceiling for discovery_config.chat.prompt. The console textarea matches it. */
export const CHAT_PROMPT_MAX = 12_000;

/**
 * Pool admission. EVERY ONE OF THESE MUST BE EXPRESSIBLE AS A QUERY PREDICATE.
 *
 * That is not a style preference. A pool is capped before anything ranks, so
 * a filter applied AFTER the fetch does not narrow the catalog — it thins the
 * page the guest actually receives, silently. Anything that cannot be pushed
 * into the WHERE clause does not belong in this box.
 */
export type DiscoveryFilters = {
  /**
   * The Enriched gate: `enriched_at IS NOT NULL` (an Enrich run completed)
   * AND `content_state = 'ready'` (the profile can be shown now) —
   * MESITA-2154. It was `content_state = 'ready'` alone (MESITA-1228), which
   * a Created place also carries. The key keeps its old name: renaming a
   * stored key silently resets the operator's value to the default.
   */
  requireReady: boolean;
  /** Google stars floor. 0 = off. Above 0 EXCLUDES unrated places — see below. */
  minRating: number;
  /** Google review-count floor. 0 = off. */
  minReviews: number;
  /** Hard radius in km. 0 = off, and off is the default — see below. */
  maxDistanceKm: number;
};

export const MIN_RATING_MAX = 5;
/** A radius past this is not a filter, it is the whole catalog. */
export const MAX_DISTANCE_KM_MAX = 200;

export const CATALOG_COUNT_MAX = 20;
export const CATALOG_PLACES_PER_RAIL_MIN = 4;
export const CATALOG_PLACES_PER_RAIL_MAX = 20;
export const CATALOG_MIN_SEED_PLACES_MAX = 20;
export const CATALOG_RAILS_CAP = 24;

export const MAP_MIN_POPULARITY_MAX = 1;
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
  const s = typeof sec === "number" && Number.isFinite(sec)
    ? sec
    : fallback.sec;
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

export const NAME_LANE_COUNT_MAX = 20;
export const NAME_FAST_COUNT_DEFAULT = 5;
export const NAME_MESITA_COUNT_DEFAULT = 3;
export const NAME_GOOGLE_COUNT_DEFAULT = 3;
/**
 * The three stops `map.pinCount` offers (How many pins). Google itself hands
 * back at most 20 per Nearby Search (New) call and the engine never widens
 * (MESITA-2298), so the stops above 20 only let Mesita Selected paint more.
 */
export const GOOGLE_PULL_STOPS = [20, 40, 60] as const;
export const GOOGLE_PULL_DEFAULT = 20;
/** `map.radiusKm` bounds. The max is Google's Nearby circle cap. */
export const MAP_RADIUS_KM_MIN = 1;
export const MAP_RADIUS_KM_MAX = 50;
export const MAP_RADIUS_KM_DEFAULT = 50;
/** Same ceiling as filters.minReviews — one review floor reads like another. */
export const GENERAL_MIN_REVIEWS_MAX = 100_000;

/**
 * The three supers the strip has always asked for stay on; the four it could
 * not see until MESITA-1683 default OFF.
 *
 * NOT for cost: there are no "four new calls" — one request carries the whole
 * battery array (MESITA-1685 corrects that claim). Off by default because it
 * keeps the returned pool exactly as it was; widening what a Nearby call
 * admits is an operator's decision, not a side effect of the list growing.
 */
export const DEFAULT_MAP_SUPERS: Record<SuperParamKey, boolean> = {
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

/** How many pins is the GUEST's question (How many, on the Filters sheet),
 *  never a knob here — the operator only decides IF Google may be called. */
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

/** `catalog.railCap` bounds and default: the Feed shows 5 per row. */
export const CATALOG_RAIL_CAP_DEFAULT = 5;
export const CATALOG_RAIL_CAP_MIN = 1;
export const CATALOG_RAIL_CAP_MAX = 10;

export const DEFAULT_CATALOG: CatalogConfig = {
  seedCount: 8,
  generatedCount: 8,
  placesPerRail: 8,
  railCap: CATALOG_RAIL_CAP_DEFAULT,
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
  minReviews: 0,
};

/**
 * The Area pipeline's provisional calibration (pipeline-signals.ts). A blob
 * with no `params` reads these.
 */
export const DEFAULT_SIGNAL_PARAMS: SignalParams = {
  proximity: { halfDistanceKm: PROXIMITY_HALF_DISTANCE_KM_DEFAULT },
  popularity: {
    referenceRating: POPULARITY_REFERENCE_RATING_DEFAULT,
    referenceReviews: POPULARITY_REFERENCE_REVIEWS_DEFAULT,
  },
};

/** Legal ranges for the three numbers the Area box edits. */
export const SIGNAL_PARAM_BOUNDS = {
  halfDistanceKm: {
    min: PROXIMITY_HALF_DISTANCE_KM_MIN,
    max: PROXIMITY_HALF_DISTANCE_KM_MAX,
    decimals: 1,
  },
  referenceRating: { min: 1, max: 5, decimals: 1 },
  referenceReviews: { min: 1, max: 1_000_000, decimals: 0 },
} as const;

export const DISCOVERY_DEFAULTS: DiscoveryConfig = {
  params: DEFAULT_SIGNAL_PARAMS,
  /**
   * `requireReady` (the Enriched gate) ships ON because it is the product
   * promise: a listed pool holds only Enriched places (MESITA-2154 made the
   * predicate match the promise).
   *
   * The quality floors ship OFF: they also exclude places with NO rating at
   * all, which in a young catalog is most of them. `maxDistanceKm` ships OFF
   * too: it exists for the operator who genuinely wants a city boundary, not
   * as the default way distance is handled.
   */
  filters: {
    requireReady: true,
    minRating: 0,
    minReviews: 0,
    maxDistanceKm: 0,
  },
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
    railCap: Math.round(
      num(
        r.railCap,
        DEFAULT_CATALOG.railCap,
        CATALOG_RAIL_CAP_MIN,
        CATALOG_RAIL_CAP_MAX,
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

/** `pinCount`: 20, 40 or 60 — snapped to the nearest stop, never a free number. */
export function normalizeGooglePull(raw: unknown): number {
  const n = num(
    raw,
    GOOGLE_PULL_DEFAULT,
    GOOGLE_PULL_STOPS[0],
    GOOGLE_PULL_STOPS[2],
  );
  let best: number = GOOGLE_PULL_DEFAULT;
  for (const stop of GOOGLE_PULL_STOPS) {
    if (Math.abs(stop - n) < Math.abs(best - n)) best = stop;
  }
  return best;
}

export function normalizeGeneralConfig(raw: unknown): GeneralConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    requireActive: bool(r.requireActive, DEFAULT_GENERAL.requireActive),
    minReviews: Math.round(
      num(r.minReviews, DEFAULT_GENERAL.minReviews, 0, GENERAL_MIN_REVIEWS_MAX),
    ),
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
  const supers = normalizeSuperParams(r.supers);
  const reload = snapMapReloadPair(r.reloadMinKm, r.reloadMinSec);
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
    reloadMinKm: reload.km,
    reloadMinSec: reload.sec,
    googleFill: bool(r.googleFill, DEFAULT_MAP.googleFill),
    supers,
    pinCount: normalizeGooglePull(r.pinCount),
    // Rebuilt key by key: an old blob's `googlePull` (the retired Legacy
    // pull, MESITA-2298) is dropped on the next save.
    radiusKm: Math.round(
      num(
        r.radiusKm,
        DEFAULT_MAP.radiusKm,
        MAP_RADIUS_KM_MIN,
        MAP_RADIUS_KM_MAX,
      ) * 10,
    ) / 10,
    googleMinReviews: Math.round(
      num(r.googleMinReviews, DEFAULT_MAP.googleMinReviews, 0, 100_000),
    ),
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
 * The Area pipeline's three numbers. Rebuilt field by field, so a stored bag
 * from the retired deck (maxKm, kneeKm, timing, category, priorRating, …) is
 * dropped on the next save.
 */
export function normalizeSignalParams(raw: unknown): SignalParams {
  const r = (raw ?? {}) as Record<string, unknown>;
  const prox = (r.proximity ?? {}) as Record<string, unknown>;
  const pop = (r.popularity ?? {}) as Record<string, unknown>;
  const d = DEFAULT_SIGNAL_PARAMS;
  return {
    proximity: {
      halfDistanceKm: boundedParam(
        prox.halfDistanceKm,
        d.proximity.halfDistanceKm,
        SIGNAL_PARAM_BOUNDS.halfDistanceKm,
      ),
    },
    popularity: {
      referenceRating: boundedParam(
        pop.referenceRating,
        d.popularity.referenceRating,
        SIGNAL_PARAM_BOUNDS.referenceRating,
      ),
      referenceReviews: boundedParam(
        pop.referenceReviews,
        d.popularity.referenceReviews,
        SIGNAL_PARAM_BOUNDS.referenceReviews,
      ),
    },
  };
}

/**
 * Tolerant read: any missing or invalid key falls back to its default, and
 * the blob is rebuilt key by key, so a retired key (`weights`,
 * `weightsByMode`, `engines`, `swipe`, MESITA-2328) is dropped on the next
 * save rather than lingering in jsonb forever.
 */
export function normalizeDiscoveryConfig(raw: unknown): DiscoveryConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const rawFilters = (r.filters ?? {}) as Record<string, unknown>;

  return {
    params: normalizeSignalParams(r.params),
    filters: {
      requireReady: bool(
        rawFilters.requireReady,
        DISCOVERY_DEFAULTS.filters.requireReady,
      ),
      // Rounded to one decimal: Google stars are one-decimal values, and a
      // floor of 4.300000000000001 would leave the page permanently dirty.
      minRating: Math.round(
        num(
          rawFilters.minRating,
          DISCOVERY_DEFAULTS.filters.minRating,
          0,
          MIN_RATING_MAX,
        ) * 10,
      ) / 10,
      minReviews: Math.round(
        num(
          rawFilters.minReviews,
          DISCOVERY_DEFAULTS.filters.minReviews,
          0,
          100_000,
        ),
      ),
      maxDistanceKm: Math.round(
        num(
          rawFilters.maxDistanceKm,
          DISCOVERY_DEFAULTS.filters.maxDistanceKm,
          0,
          MAX_DISTANCE_KM_MAX,
        ),
      ),
    },
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
