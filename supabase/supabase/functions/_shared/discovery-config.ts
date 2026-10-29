// Discovery config — the operator's half of the Discovery model (Docs ›
// Discovery, MESITA-2327).
//
// Keys: params · general · catalog · map · name · deep · chat.
// Admin: one page, five pipeline boxes (Admin Name · Consumer Name · Consumer
// Map · Consumer Catalog · Consumer Deep); each box saves only its own slices.
//
//   params     Proximity's half distance and exponent (the Catalog
//              pipeline's, MESITA-2909, MESITA-3083) and Popularity's root
//              (pipeline-signals.ts). The Catalog box edits all three.
//   general    Discovery-wide. requireActive — the post-Google wipe
//              (discovery-general-gate.ts). No reviews floor: the
//              Popularity floor is the quality cut (MESITA-2721).
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
// Area pipeline gates its own read (`mesitaPoolQuery`).
//
// RETIRED AS UNREAD (MESITA-2687): `params.modes` (the weights table: no view
// read it after MESITA-2516, and its stored Nearby row ranked Chat by distance
// alone), `map.supers` (every guest family is on; its keys and the Map's
// Nearby batteries were deleted by MESITA-2974) and
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
// `reachKm` was dropped on the next save.
//
// RETIRED WITH SELECTED (MESITA-2925): `map.selectedFactor`, the operator's
// Selected boost. Premier's factor is the row's paid tier, no knob. The
// live row still holds the key; the rebuilt map drops it on the next save.
//
// RETIRED WITH THE MAP / CATALOG SPLIT (MESITA-2909): `map.mesitaPopular` and
// `map.mesitaClosest` (the two 20-place source switches), `map.catalogPlacesShown`
// (the Catalog returns the whole ranked list; `map.catalogPageSize` pages it)
// and `params.proximity.radiusDivisor` (the Distance penalty: the Map has no
// Proximity, and the Catalog's is the log curve with `params.proximity.halfKm`,
// the half distance in km). Each is dropped on the next save.
//
// RETIRED AS ALWAYS ON (MESITA-2767): `name.fast.supers` and
// `name.deep.supers`, the Search bar's family switches. Nothing read them
// (every family rode every call), so an off switch lied to the operator.
// Migration 20261028233000 strips them from the stored row.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { bool, num } from "./config-coerce.ts";
import {
  POPULARITY_ROOT_DEFAULT,
  POPULARITY_ROOT_MAX,
  POPULARITY_ROOT_MIN,
  PROXIMITY_EXPONENT_DEFAULT,
  PROXIMITY_EXPONENT_MAX,
  PROXIMITY_EXPONENT_MIN,
  PROXIMITY_HALF_KM_DEFAULT,
  PROXIMITY_HALF_KM_MAX,
  PROXIMITY_HALF_KM_MIN,
} from "./pipeline-signals.ts";
import { errorMessage } from "./errors.ts";

/**
 * The stored signal numbers (MESITA-3083): Proximity's half distance (km)
 * and exponent (the Catalog pipeline and Chat, MESITA-2909), and
 * Popularity's root (the Map, the Catalog and Chat). The two Area weights
 * (`map.proximityWeight`, `map.popularityWeight`) stay retired
 * (MESITA-2722); Popularity's reviews for half credit (`halfReviews`) was
 * stored and mirrored but read by nothing, so it retired with MESITA-3083.
 */
export type SignalParams = {
  /** `halfKm`: Proximity is ½ at this many km (MESITA-2909); `exponent`:
   *  the curve's shape, 1 = the plain reciprocal (MESITA-3083). */
  proximity: { halfKm: number; exponent: number };
  /** `root`: Popularity is (1 + reviews × stars)^root, 0.33 = the cube root. */
  popularity: { root: number };
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
 * The Map and Catalog pipelines' policy (MESITA-2909): the Map ranks every
 * Mesita place inside its screen radius by Popularity × the Premier factor
 * and shows the top `placesShown`; the Catalog ranks the whole catalog by
 * Proximity × Popularity × the factor and pages it by `catalogPageSize`.
 * Mesita's places only (Google Nearby retired in MESITA-2872). Operator
 * numbers since MESITA-1699. Floors still exclude; 0 = off.
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
  // `googlePopular` / `googleClosest` (the two Google Nearby sources)
  // retired in MESITA-2872; `mesitaPopular` / `mesitaClosest` (the two
  // Mesita ones) in MESITA-2909: each pipeline reads every Mesita place.
  /**
   * THE CURRENT-LOCATION RADIUS (km): the Map's when it has no screen to
   * measure, and Chat's read (MESITA-2703). The Catalog has no radius
   * (MESITA-2909). `MAP_RADIUS_KM_MIN`..`MAP_RADIUS_KM_MAX`. One decimal.
   */
  radiusKm: number;
  // `proximityWeight` and `popularityWeight` (the exponents a and b,
  // MESITA-2504/2703) retired in MESITA-2722: dropped on the next Save.
  /**
   * THE MAP'S MOST PINS (Pato, MESITA-2713, MESITA-2909: "cuántos puntos se
   * van a mostrar máximo, cincuenta"): the top N of the places inside the
   * screen radius, by Popularity × the Premier factor.
   * `MAP_PLACES_SHOWN_MIN`..`MAX`, whole, default 50.
   */
  placesShown: number;
  /**
   * THE CATALOG'S PAGE SIZE (MESITA-2909): Home draws the ranked catalog
   * this many places at a time. `CATALOG_PAGE_SIZE_MIN`..`MAX`, whole,
   * default 20. It replaced `catalogPlacesShown` (MESITA-2727), a cut.
   */
  catalogPageSize: number;
  /**
   * THE POPULARITY FLOOR (Pato, MESITA-2714: "if popularity score is below
   * 3 you cannot be shown … it doesn't matter what"): a place whose
   * Popularity, (1 + reviews × stars)^root, is under it never shows on
   * Home, the Map or Chat, Google or Mesita. `MAP_POPULARITY_FLOOR_MIN`..
   * `MAX`, one decimal, default 2.7 (the old 3 in ln units, re-expressed
   * at the cube root, MESITA-3083); 0 is off.
   */
  popularityFloor: number;
  // `selectedFactor` (the Selected boost, MESITA-2717) retired with
  // Selected in MESITA-2925: dropped on the next Save.
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
  map: MapConfig;
  name: NameConfig;
  deep: DeepConfig;
  chat: { prompt: string };
};

/** Ceiling for discovery_config.chat.prompt. The console textarea matches it. */
export const CHAT_PROMPT_MAX = 12_000;

/** Google stars top out at 5: the ceiling of `map.minRating`. */
export const MIN_RATING_MAX = 5;

export const MAP_MIN_POPULARITY_MAX = 1;

export const NAME_LANE_COUNT_MAX = 20;
export const NAME_FAST_COUNT_DEFAULT = 5;
export const NAME_GOOGLE_COUNT_DEFAULT = 3;
/** `map.radiusKm` bounds. */
export const MAP_RADIUS_KM_MIN = 1;
export const MAP_RADIUS_KM_MAX = 50;
export const MAP_RADIUS_KM_DEFAULT = 15;
/** `map.placesShown` bounds (MESITA-2909). */
export const MAP_PLACES_SHOWN_MIN = 1;
export const MAP_PLACES_SHOWN_MAX = 200;
export const MAP_PLACES_SHOWN_DEFAULT = 50;
/** `map.catalogPageSize` bounds (MESITA-2909). */
export const CATALOG_PAGE_SIZE_MIN = 5;
export const CATALOG_PAGE_SIZE_MAX = 100;
export const CATALOG_PAGE_SIZE_DEFAULT = 20;
/** `map.popularityFloor` bounds, in Popularity's own units (the root's,
 *  MESITA-3083: at the cube root 2.7 ≈ reviews × stars of 19, what the old
 *  ln floor of 3 meant). */
export const MAP_POPULARITY_FLOOR_MIN = 0;
export const MAP_POPULARITY_FLOOR_MAX = 20;
export const MAP_POPULARITY_FLOOR_DEFAULT = 2.7;
/** The Map's reload throttle (s): the consumer clamps to the same 0.5–10. */
export const MAP_RELOAD_IDLE_SEC_MIN = 0.5;
export const MAP_RELOAD_IDLE_SEC_MAX = 10;
export const MAP_RELOAD_IDLE_SEC_DEFAULT = 1.5;
/** Min share of the last-reload screen a guest move must cover (MESITA-2732). */
export const MAP_RELOAD_MIN_VIEWPORT_PCT_MIN = 0;
export const MAP_RELOAD_MIN_VIEWPORT_PCT_MAX = 50;
export const MAP_RELOAD_MIN_VIEWPORT_PCT_DEFAULT = 15;

/** How many pins is the GUEST's question (How many, on the Filters sheet),
 *  never a knob here — the operator only decides IF Google may be called. */
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

export const DEFAULT_NAME_FAST: NameFastConfig = {
  googleCount: NAME_FAST_COUNT_DEFAULT,
  count: NAME_FAST_COUNT_DEFAULT,
};

export const DEFAULT_NAME_DEEP: NameDeepConfig = {
  autoCount: NAME_GOOGLE_COUNT_DEFAULT,
  googleCount: NAME_GOOGLE_COUNT_DEFAULT,
};

/** Word's idle bounds (seconds). */
export const NAME_IDLE_SEC_MIN = 0.3;
export const NAME_IDLE_SEC_MAX = 5;
export const NAME_ADMIN_TEXT_MAX = 20;

/** Find's behaviour before these knobs existed: no Autocomplete, a Text
 *  Search page of 20, the catalogue on an empty query. The Mesita name
 *  rows (`mesitaCount`) left with the Mesita Name lane (MESITA-2896). */
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
  // ON by default (Pato, 2026-08-29). A closed place is not a search
  // result, and the live blob predates the key — so the default is what
  // every surface reads until the operator says otherwise.
  requireActive: true,
};

/** The signal numbers. A blob with no `params` reads these. */
export const DEFAULT_SIGNAL_PARAMS: SignalParams = {
  proximity: { halfKm: PROXIMITY_HALF_KM_DEFAULT, exponent: PROXIMITY_EXPONENT_DEFAULT },
  popularity: { root: POPULARITY_ROOT_DEFAULT },
};

/** Legal ranges for the signal numbers. */
export const SIGNAL_PARAM_BOUNDS = {
  halfKm: {
    min: PROXIMITY_HALF_KM_MIN,
    max: PROXIMITY_HALF_KM_MAX,
    decimals: 1,
  },
  exponent: {
    min: PROXIMITY_EXPONENT_MIN,
    max: PROXIMITY_EXPONENT_MAX,
    decimals: 1,
  },
  root: {
    min: POPULARITY_ROOT_MIN,
    max: POPULARITY_ROOT_MAX,
    decimals: 2,
  },
} as const;

export const DISCOVERY_DEFAULTS: DiscoveryConfig = {
  params: DEFAULT_SIGNAL_PARAMS,
  general: DEFAULT_GENERAL,
  map: DEFAULT_MAP,
  name: DEFAULT_NAME,
  deep: DEFAULT_DEEP,
  chat: { prompt: "" },
};

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
    },
    deep: {
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
    emptyQuery: bool(a.emptyQuery, DEFAULT_NAME_ADMIN.emptyQuery),
  };
}

export function normalizeMapConfig(raw: unknown): MapConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
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
    // the reload km/sec pair, the 20/40/60 stops, `googleFill`, the four
    // source switches, `catalogPlacesShown`, `selectedFactor`) is dropped on
    // the next save.
    radiusKm: Math.round(
      num(
        r.radiusKm,
        DEFAULT_MAP.radiusKm,
        MAP_RADIUS_KM_MIN,
        MAP_RADIUS_KM_MAX,
      ) * 10,
    ) / 10,
    placesShown: Math.round(
      num(r.placesShown, DEFAULT_MAP.placesShown, MAP_PLACES_SHOWN_MIN, MAP_PLACES_SHOWN_MAX),
    ),
    catalogPageSize: Math.round(
      num(r.catalogPageSize, DEFAULT_MAP.catalogPageSize, CATALOG_PAGE_SIZE_MIN, CATALOG_PAGE_SIZE_MAX),
    ),
    popularityFloor: Math.round(
      num(
        r.popularityFloor,
        DEFAULT_MAP.popularityFloor,
        MAP_POPULARITY_FLOOR_MIN,
        MAP_POPULARITY_FLOOR_MAX,
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
 * The signal numbers. Rebuilt field by field, so a stored bag
 * from the retired deck (maxKm, kneeKm, timing, category, priorRating, …)
 * or the retired calibration (proximity.halfDistanceKm,
 * popularity.referenceRating/referenceReviews, MESITA-2347), the linear
 * `balance` (MESITA-2428), the weights table `modes` (MESITA-2687) or
 * `proximity.reachKm` / `selected` (MESITA-2703) is dropped on the next
 * save. `proximity.halfKm` (the half distance, MESITA-2909) and
 * `proximity.exponent` (MESITA-3083) are the proximity fields read;
 * `radiusDivisor` (MESITA-2720, retired by MESITA-2909) and
 * `catalogRadiusDivisor` (MESITA-2727/2776) drop. `popularity.root` is the
 * one popularity field (MESITA-3083); `halfReviews`, read by nothing,
 * drops with it. A missing key reads its default: a row stored before a
 * knob existed never resets the others (keys are added, never renamed).
 */
export function normalizeSignalParams(raw: unknown): SignalParams {
  const r = (raw ?? {}) as Record<string, unknown>;
  const prox = (r.proximity ?? {}) as Record<string, unknown>;
  const pop = (r.popularity ?? {}) as Record<string, unknown>;
  const d = DEFAULT_SIGNAL_PARAMS;
  return {
    proximity: {
      halfKm: boundedParam(
        prox.halfKm,
        d.proximity.halfKm,
        SIGNAL_PARAM_BOUNDS.halfKm,
      ),
      exponent: boundedParam(
        prox.exponent,
        d.proximity.exponent,
        SIGNAL_PARAM_BOUNDS.exponent,
      ),
    },
    popularity: {
      root: boundedParam(
        pop.root,
        d.popularity.root,
        SIGNAL_PARAM_BOUNDS.root,
      ),
    },
  };
}

/**
 * Tolerant read: any missing or invalid key falls back to its default, and
 * the blob is rebuilt key by key, so a retired key (`weights`,
 * `weightsByMode`, `engines`, `swipe`, MESITA-2328; `filters`, MESITA-2337;
 * the rails engine's `catalog`, MESITA-2923)
 * is dropped on the next save rather than lingering in jsonb forever.
 */
export function normalizeDiscoveryConfig(raw: unknown): DiscoveryConfig {
  const r = (raw ?? {}) as Record<string, unknown>;

  return {
    params: normalizeSignalParams(r.params),
    general: normalizeGeneralConfig(r.general),
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
    console.error("[discovery-config] read threw:", errorMessage(e));
    return DISCOVERY_DEFAULTS;
  }
}
