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
 * The stored signal numbers (MESITA-3083): Proximity's half distance (km)
 * and exponent (the Catalog pipeline and Chat, MESITA-2909) and
 * Popularity's root (the Map, the Catalog and Chat). Mirrors SignalParams
 * in _shared/discovery-config.ts. `halfReviews` retired with MESITA-3083.
 */
export type SignalParams = {
  /** Proximity is 1 ÷ (1 + (d ÷ D)^e): ½ at D km whatever e is
   *  (MESITA-3015); e = 1 is the plain reciprocal (MESITA-3083). */
  proximity: { halfKm: number; exponent: number };
  /** Popularity is (1 + reviews × stars)^root; 0.33 is the cube root. */
  popularity: { root: number };
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

export type DiscoveryConfig = {
  params: SignalParams;
  general: GeneralConfig;
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

/** Mirrors the Proximity bounds in _shared/pipeline-signals.ts (MESITA-3015, MESITA-3083). */
export const HALF_KM_MIN = 0.1;
export const HALF_KM_MAX = 100;
export const EXPONENT_MIN = 0.5;
export const EXPONENT_MAX = 4;
/** Mirrors the Popularity root bounds in _shared/pipeline-signals.ts (MESITA-3083). */
export const POPULARITY_ROOT_MIN = 0.1;
export const POPULARITY_ROOT_MAX = 1;

/** Mirrors MAP_RADIUS_KM_* in _shared/discovery-config.ts. */
export const MAP_RADIUS_KM_MIN = 1;
export const MAP_RADIUS_KM_MAX = 50;
const MAP_RADIUS_KM_DEFAULT = 15;
/** Mirrors MAP_PLACES_SHOWN_* in _shared/discovery-config.ts (MESITA-2713, MESITA-2909). */
export const MAP_PLACES_SHOWN_MIN = 1;
export const MAP_PLACES_SHOWN_MAX = 200;
const MAP_PLACES_SHOWN_DEFAULT = 50;
/** Mirrors CATALOG_PAGE_SIZE_* in _shared/discovery-config.ts (MESITA-2909). */
export const CATALOG_PAGE_SIZE_MIN = 5;
export const CATALOG_PAGE_SIZE_MAX = 100;
const CATALOG_PAGE_SIZE_DEFAULT = 20;
/** Mirrors MAP_POPULARITY_FLOOR_* in _shared/discovery-config.ts (MESITA-2714;
 *  in the Popularity root's units since MESITA-3083: 2.7 ≈ reviews × stars of 19). */
export const MAP_POPULARITY_FLOOR_MIN = 0;
export const MAP_POPULARITY_FLOOR_MAX = 20;
const MAP_POPULARITY_FLOOR_DEFAULT = 2.7;
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
  /** The current-location radius (km): the Map's with no screen, Chat's
   *  (MESITA-2703). The Catalog has no radius (MESITA-2909). */
  radiusKm: number;
  // `proximityWeight` / `popularityWeight` retired (MESITA-2722).
  /** The Map's most pins, 1..200, default 50 (MESITA-2713, MESITA-2909). */
  placesShown: number;
  /** Home's Catalog page size, 5..100, default 20 (MESITA-2909; it
   *  replaced `catalogPlacesShown`). */
  catalogPageSize: number;
  /** The Popularity floor in the root's units, 0..20, default 2.7; 0 = off
   *  (MESITA-2714, MESITA-3083). */
  popularityFloor: number;
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
  radiusKm: MAP_RADIUS_KM_DEFAULT,
  placesShown: MAP_PLACES_SHOWN_DEFAULT,
  catalogPageSize: CATALOG_PAGE_SIZE_DEFAULT,
  popularityFloor: MAP_POPULARITY_FLOOR_DEFAULT,
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
};

export const DEFAULT_GENERAL: GeneralConfig = {
  requireActive: true,
};

/** Mirrors DEFAULT_SIGNAL_PARAMS. */
const DEFAULT_SIGNAL_PARAMS: SignalParams = {
  proximity: { halfKm: 1, exponent: 1 },
  popularity: { root: 0.33 },
};

export const DEFAULT_CONFIG: DiscoveryConfig = {
  params: DEFAULT_SIGNAL_PARAMS,
  general: DEFAULT_GENERAL,
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
  const d = DEFAULT_SIGNAL_PARAMS;
  return {
    proximity: {
      halfKm: bounded(prox.halfKm, d.proximity.halfKm, HALF_KM_MIN, HALF_KM_MAX, 1),
      exponent: bounded(prox.exponent, d.proximity.exponent, EXPONENT_MIN, EXPONENT_MAX, 1),
    },
    popularity: {
      root: bounded(pop.root, d.popularity.root, POPULARITY_ROOT_MIN, POPULARITY_ROOT_MAX, 2),
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
    // source switches, `catalogPlacesShown`) is dropped on the next save.
    radiusKm:
      Math.round(
        num(m.radiusKm, DEFAULT_MAP.radiusKm, MAP_RADIUS_KM_MIN, MAP_RADIUS_KM_MAX) * 10,
      ) / 10,
    placesShown: Math.round(
      num(m.placesShown, DEFAULT_MAP.placesShown, MAP_PLACES_SHOWN_MIN, MAP_PLACES_SHOWN_MAX),
    ),
    catalogPageSize: Math.round(
      num(m.catalogPageSize, DEFAULT_MAP.catalogPageSize, CATALOG_PAGE_SIZE_MIN, CATALOG_PAGE_SIZE_MAX),
    ),
    popularityFloor:
      Math.round(
        num(m.popularityFloor, DEFAULT_MAP.popularityFloor, MAP_POPULARITY_FLOOR_MIN, MAP_POPULARITY_FLOOR_MAX) * 10,
      ) / 10,
  };
}
