// Discovery config — the operator's half of the Discovery model (Docs ›
// Discovery, MESITA-2327).
//
// Keys: params · general · map · name · deep · chat · premier · social.
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
//   premier    Premier's yearly prices per plan, in US cents (MESITA-3043, yearly
//              since MESITA-3285; code constants until then). Read by every Premier quote
//              (premier-flow.ts) and Billing's Keep line; the Premier Prices
//              box edits it. A top-level key, not `params.premier`: `params`
//              is the signal numbers, and the Catalog box saves all of it.
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

//
// DISCOVERY RANKING v2 (MESITA-4454): `params.recipes` (sixteen Catalog rows plus the Map's two since MESITA-4548, one per
// screen · mode · lane) and `params.mix` (per-mode Temperature, ad floor,
// ad cadence) are what the Map, the Catalog and Chat read now. Seeded by
// migration 20261119060000; a missing key reads its default. The keys they
// replace (`params.proximity`, `params.popularity.root` and `.starsPower`,
// `params.shuffle.temperature`, `map.popularityRoot`) are still normalized
// and kept, but UNREAD, until a follow-up migration deletes them (F8).
//
// UNKNOWN KEYS SURVIVE (H-2): under `params` and `map` the normalized object
// is the raw one with the typed keys overlaid, so a key this build does not
// know (a newer build's, or a retired one waiting for its migration) is never
// dropped by a read or a save.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { asRecord, bool, num } from "./config-coerce.ts";
import {
  AD_EVERY_MAX,
  AD_EVERY_MIN,
  PLAN_FACTOR_MAX,
  PLAN_FACTOR_MIN,
  FOURSQUARE_EXPONENT_MAX,
  FOURSQUARE_EXPONENT_MIN,
  FOURSQUARE_FACTOR_MAX,
  FOURSQUARE_FACTOR_MIN,
  GOOGLE_EXP_MAX,
  GOOGLE_EXP_MIN,
  GROWTH_WEIGHT_CAP_MAX,
  GROWTH_WEIGHT_CAP_MIN,
  MIX_TEMPERATURE_MAX,
  MIX_TEMPERATURE_MIN,
  PREMIER_EXP_MAX,
  PREMIER_EXP_MIN,
  type RankMode,
  type Recipe,
  POPULARITY_ROOT_DEFAULT,
  POPULARITY_ROOT_MAX,
  POPULARITY_ROOT_MIN,
  PROXIMITY_EXPONENT_DEFAULT,
  PROXIMITY_EXPONENT_MAX,
  PROXIMITY_EXPONENT_MIN,
  PROXIMITY_HALF_KM_DEFAULT,
  PROXIMITY_HALF_KM_MAX,
  PROXIMITY_HALF_KM_MIN,
  SHUFFLE_TEMPERATURE_DEFAULT,
  SHUFFLE_TEMPERATURE_MAX,
  SHUFFLE_TEMPERATURE_MIN,
  STARS_POWER_DEFAULT,
  STARS_POWER_MAX,
  STARS_POWER_MIN,
} from "./pipeline-signals.ts";
import { errorMessage } from "./errors.ts";
import { PREMIER_FACTOR, PREMIER_TIERS, PREMIER_YEARLY_CENTS, type PremierPrices } from "./boost.ts";

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
  /** `root`: Popularity is (1 + reviews × stars)^root, 0.33 = the cube
   *  root; `starsPower`: × (stars ÷ 5)^k on the Catalog and Chat
   *  (MESITA-4153). */
  popularity: { root: number; starsPower: number };
  /** `temperature`: Home's shuffle after the sort; 0 = none (MESITA-4153).
   *  UNREAD since MESITA-4454 (`mix.temperature` per mode replaces it). */
  shuffle: { temperature: number };
  /** The recipe rows (MESITA-4454, MESITA-4517, MESITA-4548). */
  recipes: Recipes;
  /** Home's mix (MESITA-4454): per-mode Temperature, ad floor, ad cadence. */
  mix: MixParams;
};

/** The recipe rows, Catalog modes × lanes plus the Map's two (MESITA-4454).
 *  Family is three organic lanes since MESITA-4517: close, well known, and
 *  both (strong on both; nearest first). */
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

/** `params.mix` (MESITA-4454). `temperature` per mode (the first-page
 *  shuffle; 0 = the merged order exactly); `adEvery`: one ad slot after every N organic
 *  places, 0 = no ads (Catalog and Map). `growthWeightCap` is still loaded so
 *  an old save round-trips. Ranking ignores it: recent weight is fixed at
 *  0.20 + 0.60 × min(observedDays / 30, 1), capped at 80%. */
export type MixParams = {
  temperature: Record<RankMode, number>;
  adEvery: number;
  /** Premier Pro's and Premier Max's factor (MESITA-5028): what each plan
   *  multiplies a score by. Free is 1. (The ad floor that
   *  compared them is gone, MESITA-5029; a saved `adFloor` is dropped.) */
  proFactor: number;
  maxFactor: number;
  growthWeightCap: number;
};

/** Every row but "…Inorganic" is organic (the Family lanes end Close,
 *  WellKnown and Both, MESITA-4517). */
export const isOrganicRow = (row: RecipeRow) => !row.endsWith("Inorganic");
export const isMapRow = (row: RecipeRow) => row.startsWith("map");

/** The recipe table (Pato, 2026-11-19); the migration seeds the same values. */
export const DEFAULT_RECIPES: Recipes = {
  // MESITA-4557: Inorganic rows take half the Foursquare boost (max 1.5×),
  // as they take half the Google exponent.
  catalogNearbyOrganic: { halfKm: 0.1, distanceExp: 4, googleExp: 0.33, foursquareFactor: 1, foursquareExponent: 20, premierExp: 0, batch: 10 },
  catalogNearbyInorganic: { halfKm: 0.5, distanceExp: 2, googleExp: 0.17, foursquareFactor: 0.5, foursquareExponent: 20, premierExp: 1, batch: 10 },
  // MESITA-4548: Nearby both copies Nearby close; each new Inorganic row
  // copies its feed's Inorganic row.
  catalogNearbyBoth: { halfKm: 0.1, distanceExp: 4, googleExp: 0.33, foursquareFactor: 1, foursquareExponent: 20, premierExp: 0, batch: 10 },
  catalogNearbyBothInorganic: { halfKm: 0.5, distanceExp: 2, googleExp: 0.17, foursquareFactor: 0.5, foursquareExponent: 20, premierExp: 1, batch: 10 },
  // MESITA-4517: close copies Nearby Organic, well known copies Popular
  // Organic, both keeps the old Family Organic knobs.
  catalogFamilyClose: { halfKm: 0.1, distanceExp: 4, googleExp: 0.33, foursquareFactor: 1, foursquareExponent: 20, premierExp: 0, batch: 10 },
  catalogFamilyCloseInorganic: { halfKm: 2, distanceExp: 2, googleExp: 0.17, foursquareFactor: 0.5, foursquareExponent: 20, premierExp: 1, batch: 10 },
  catalogFamilyWellKnown: { halfKm: 10, distanceExp: 2, googleExp: 0.33, foursquareFactor: 1, foursquareExponent: 20, premierExp: 0, batch: 10 },
  catalogFamilyWellKnownInorganic: { halfKm: 2, distanceExp: 2, googleExp: 0.17, foursquareFactor: 0.5, foursquareExponent: 20, premierExp: 1, batch: 10 },
  catalogFamilyBoth: { halfKm: 2, distanceExp: 2, googleExp: 0.33, foursquareFactor: 1, foursquareExponent: 20, premierExp: 0, batch: 10 },
  catalogFamilyBothInorganic: { halfKm: 2, distanceExp: 2, googleExp: 0.17, foursquareFactor: 0.5, foursquareExponent: 20, premierExp: 1, batch: 10 },
  catalogPopularOrganic: { halfKm: 10, distanceExp: 2, googleExp: 0.33, foursquareFactor: 1, foursquareExponent: 20, premierExp: 0, batch: 10 },
  catalogPopularInorganic: { halfKm: 10, distanceExp: 2, googleExp: 0.17, foursquareFactor: 0.5, foursquareExponent: 20, premierExp: 1, batch: 10 },
  catalogPopularBoth: { halfKm: 10, distanceExp: 2, googleExp: 0.33, foursquareFactor: 1, foursquareExponent: 20, premierExp: 0, batch: 10 },
  catalogPopularBothInorganic: { halfKm: 10, distanceExp: 2, googleExp: 0.17, foursquareFactor: 0.5, foursquareExponent: 20, premierExp: 1, batch: 10 },
  mapOrganic: { halfKm: null, distanceExp: null, googleExp: 0.33, foursquareFactor: 1, foursquareExponent: 20, premierExp: 0, batch: null },
  mapInorganic: { halfKm: null, distanceExp: null, googleExp: 0.17, foursquareFactor: 0.5, foursquareExponent: 20, premierExp: 1, batch: null },
};

/** A Catalog lane's batch when a caller's row has none (MESITA-4517). */
export const LANE_BATCH_DEFAULT = 10;
export const LANE_BATCH_MIN = 1;
/** 25: a Family weave (three lanes plus Inorganic) stays within one
 *  100-id fill. */
export const LANE_BATCH_MAX = 25;

export const DEFAULT_MIX: MixParams = {
  temperature: { nearby: 0.33, family: 0.5, popular: 1 },
  adEvery: 1,
  proFactor: PREMIER_FACTOR[1],
  maxFactor: PREMIER_FACTOR[2],
  growthWeightCap: 0.5,
};

/** Legal ranges of a recipe row and of the mix (MESITA-4454). */
export const RECIPE_BOUNDS = {
  halfKm: { min: PROXIMITY_HALF_KM_MIN, max: PROXIMITY_HALF_KM_MAX, decimals: 2 },
  distanceExp: { min: PROXIMITY_EXPONENT_MIN, max: PROXIMITY_EXPONENT_MAX, decimals: 1 },
  googleExp: { min: GOOGLE_EXP_MIN, max: GOOGLE_EXP_MAX, decimals: 2 },
  foursquareFactor: { min: FOURSQUARE_FACTOR_MIN, max: FOURSQUARE_FACTOR_MAX, decimals: 2 },
  foursquareExponent: { min: FOURSQUARE_EXPONENT_MIN, max: FOURSQUARE_EXPONENT_MAX, decimals: 0 },
  premierExp: { min: PREMIER_EXP_MIN, max: PREMIER_EXP_MAX, decimals: 1 },
  batch: { min: LANE_BATCH_MIN, max: LANE_BATCH_MAX, decimals: 0 },
} as const;

export const MIX_BOUNDS = {
  temperature: { min: MIX_TEMPERATURE_MIN, max: MIX_TEMPERATURE_MAX, decimals: 2 },
  adEvery: { min: AD_EVERY_MIN, max: AD_EVERY_MAX, decimals: 0 },
  proFactor: { min: PLAN_FACTOR_MIN, max: PLAN_FACTOR_MAX, decimals: 1 },
  maxFactor: { min: PLAN_FACTOR_MIN, max: PLAN_FACTOR_MAX, decimals: 1 },
  growthWeightCap: { min: GROWTH_WEIGHT_CAP_MIN, max: GROWTH_WEIGHT_CAP_MAX, decimals: 2 },
} as const;

/** Told about every stored value the normalizer could not keep as is: out
 *  of bounds (clamped), not a number, or null where a number is required
 *  (DX-f, L-1). `key` is the dotted path. */
export type OnClamp = (key: string, raw: unknown) => void;

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
  // `radiusKm` (the current-location radius) retired in MESITA-3086 (Pato:
  // "the radius depends on the screen size"): the no-screen fallback, Chat
  // and the Social feed read `NO_SCREEN_RADIUS_KM`. Dropped on the next Save.
  /**
   * THE MAP'S POPULARITY ROOT (MESITA-3086): the Map ranks by
   * (1 + reviews × stars)^popularityRoot × the Premier factor, so the root
   * only sets how much a Premier plan outweighs reviews there (two plain
   * places keep their order at any root). `POPULARITY_ROOT_MIN`..`MAX`, two
   * decimals, default 0.33. The Catalog's root is `params.popularity.root`.
   */
  popularityRoot: number;
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
   * THE MAP'S DOTS (Pato, MESITA-3980: "only first n places are loaded into
   * carousel but all the small dots are already in the map"): how many of
   * the ranked places the map marks in all. The top `placesShown` are full
   * pins with cards; the places after them, up to this many, are small dots
   * — a mark that says "zoom in here", no card, no label.
   * `MAP_DOTS_SHOWN_MIN`..`MAX`, whole, default 200; at or under
   * `placesShown` there are no dots.
   */
  dotsShown: number;
  /**
   * THE CATALOG'S PAGE SIZE (MESITA-2909): Home draws the ranked catalog
   * this many places at a time. `CATALOG_PAGE_SIZE_MIN`..`MAX`, whole,
   * default 20. It replaced `catalogPlacesShown` (MESITA-2727), a cut.
   * UNREAD since MESITA-4517: each lane's `batch` sizes a weave, and the
   * first weave is the page. Still loaded so an old save round-trips.
   */
  catalogPageSize: number;
  // `popularityFloor` moved to `name.popularityFloor` (MESITA-3086, Pato:
  // "Minimum popularity must go to the Name Search, not to the catalog nor
  // map"): Home, the Map and Chat no longer hide a place for its
  // Popularity. Dropped on the next Save.
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
  /**
   * MINIMUM POPULARITY (MESITA-2714; Name-only since MESITA-3086): on the
   * guest Search bar, Google-only places whose Popularity, read at the
   * Catalog's root (`params.popularity.root`), is under it sort after the
   * rest; none are removed. `NAME_POPULARITY_FLOOR_MIN`..`MAX`, one
   * decimal, default 2.7 (≈ 4★ × 5 reviews at the cube root); 0 is off.
   */
  popularityFloor: number;
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
  /**
   * Home's temporary score overlay on each row's photo (MESITA-4449) is
   * drawn (MESITA-4757, Pato: "toggle if show score data on top of images
   * or if not"). Display only: it changes no rank. The catalog EF sends it
   * on every rank answer as `showScores`.
   */
  showScores: boolean;
  // `minReviews` retired (MESITA-2702), and `map.googleMinReviews` with it
  // (MESITA-2721): both dropped on the next Save, never renamed.
};

/**
 * Premier's prices (MESITA-3043): the yearly price of each plan in US
 * cents, whole; plans are sold yearly only (MESITA-3285, `yearlyCents`
 * replaced `monthlyCents`, which was never set live). A price is stored on
 * the pledge when bought, so a change reaches new purchases and plan
 * changes, never a renewal already promised.
 */
export type PremierConfig = { yearlyCents: PremierPrices };

/** Bounds of one yearly price, in cents: $1 (over Stripe's 50-cent floor)
 *  to $100,000. */
export const PREMIER_YEARLY_CENTS_MIN = 100;
export const PREMIER_YEARLY_CENTS_MAX = 10_000_000;

export const DEFAULT_PREMIER: PremierConfig = { yearlyCents: PREMIER_YEARLY_CENTS };

export type DiscoveryConfig = {
  params: SignalParams;
  general: GeneralConfig;
  map: MapConfig;
  name: NameConfig;
  deep: DeepConfig;
  chat: { prompt: string };
  premier: PremierConfig;
  /** Home › Social (MESITA-4572): how many of the newest events near the
   *  guest the all-places feed shows before it ends. */
  social: SocialConfig;
};

export type SocialConfig = { latestEvents: number };
export const SOCIAL_LATEST_EVENTS_MIN = 1;
export const SOCIAL_LATEST_EVENTS_MAX = 500;
export const DEFAULT_SOCIAL: SocialConfig = { latestEvents: 100 };

export function normalizeSocialConfig(raw: unknown): SocialConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    latestEvents: Math.round(
      num(r.latestEvents, DEFAULT_SOCIAL.latestEvents, SOCIAL_LATEST_EVENTS_MIN, SOCIAL_LATEST_EVENTS_MAX),
    ),
  };
}

/** Ceiling for discovery_config.chat.prompt. The console textarea matches it. */
export const CHAT_PROMPT_MAX = 12_000;

/** Google stars top out at 5: the ceiling of `map.minRating`. */
export const MIN_RATING_MAX = 5;

export const MAP_MIN_POPULARITY_MAX = 1;

export const NAME_LANE_COUNT_MAX = 20;
export const NAME_FAST_COUNT_DEFAULT = 5;
export const NAME_GOOGLE_COUNT_DEFAULT = 3;
/** The radius (km) when there is no screen to measure: the Map's fallback,
 *  Chat's read and the Social feed's "near you" circle. A constant since
 *  MESITA-3086 retired `map.radiusKm` (live was 15). */
export const NO_SCREEN_RADIUS_KM = 15;
/** `map.placesShown` bounds (MESITA-2909). */
export const MAP_PLACES_SHOWN_MIN = 1;
export const MAP_PLACES_SHOWN_MAX = 200;
export const MAP_PLACES_SHOWN_DEFAULT = 50;
/** `map.dotsShown` bounds (MESITA-3980). */
export const MAP_DOTS_SHOWN_MIN = 0;
export const MAP_DOTS_SHOWN_MAX = 1000;
export const MAP_DOTS_SHOWN_DEFAULT = 200;
/** `map.catalogPageSize` bounds (MESITA-2909). */
export const CATALOG_PAGE_SIZE_MIN = 5;
export const CATALOG_PAGE_SIZE_MAX = 100;
export const CATALOG_PAGE_SIZE_DEFAULT = 20;
/** `name.popularityFloor` bounds, in Popularity's own units (the Catalog
 *  root's, MESITA-3083: at the cube root 2.7 ≈ reviews × stars of 19).
 *  It was `map.popularityFloor` until MESITA-3086. */
export const NAME_POPULARITY_FLOOR_MIN = 0;
export const NAME_POPULARITY_FLOOR_MAX = 20;
export const NAME_POPULARITY_FLOOR_DEFAULT = 2.7;
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
  popularityRoot: POPULARITY_ROOT_DEFAULT,
  placesShown: MAP_PLACES_SHOWN_DEFAULT,
  dotsShown: MAP_DOTS_SHOWN_DEFAULT,
  catalogPageSize: CATALOG_PAGE_SIZE_DEFAULT,
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
  popularityFloor: NAME_POPULARITY_FLOOR_DEFAULT,
};

export const DEFAULT_GENERAL: GeneralConfig = {
  // ON by default (Pato, 2026-08-29). A closed place is not a search
  // result, and the live blob predates the key — so the default is what
  // every surface reads until the operator says otherwise.
  requireActive: true,
  // ON: the overlay was always drawn before the switch (MESITA-4757).
  showScores: true,
};

/** The signal numbers. A blob with no `params` reads these. */
export const DEFAULT_SIGNAL_PARAMS: SignalParams = {
  proximity: { halfKm: PROXIMITY_HALF_KM_DEFAULT, exponent: PROXIMITY_EXPONENT_DEFAULT },
  popularity: { root: POPULARITY_ROOT_DEFAULT, starsPower: STARS_POWER_DEFAULT },
  shuffle: { temperature: SHUFFLE_TEMPERATURE_DEFAULT },
  recipes: DEFAULT_RECIPES,
  mix: DEFAULT_MIX,
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
  starsPower: {
    min: STARS_POWER_MIN,
    max: STARS_POWER_MAX,
    decimals: 1,
  },
  temperature: {
    min: SHUFFLE_TEMPERATURE_MIN,
    max: SHUFFLE_TEMPERATURE_MAX,
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
  premier: DEFAULT_PREMIER,
  social: DEFAULT_SOCIAL,
};

/** Every plan's price, whole cents, clamped; a missing or invalid one reads
 *  its default, and a retired tier (`boost_10x`) drops on the next save. */
export function normalizePremierConfig(raw: unknown): PremierConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const m = (r.yearlyCents ?? {}) as Record<string, unknown>;
  const yearlyCents = {} as PremierPrices;
  for (const tier of PREMIER_TIERS) {
    yearlyCents[tier] = Math.round(
      num(m[tier], DEFAULT_PREMIER.yearlyCents[tier], PREMIER_YEARLY_CENTS_MIN, PREMIER_YEARLY_CENTS_MAX),
    );
  }
  return { yearlyCents };
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

export function normalizeGeneralConfig(raw: unknown): GeneralConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    requireActive: bool(r.requireActive, DEFAULT_GENERAL.requireActive),
    showScores: bool(r.showScores, DEFAULT_GENERAL.showScores),
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
    popularityFloor: Math.round(
      num(
        r.popularityFloor,
        DEFAULT_NAME.popularityFloor,
        NAME_POPULARITY_FLOOR_MIN,
        NAME_POPULARITY_FLOOR_MAX,
      ) * 10,
    ) / 10,
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
    // source switches, `catalogPlacesShown`, `selectedFactor`, and since
    // MESITA-3086 `radiusKm` and `popularityFloor`) is dropped on
    // the next save.
    popularityRoot: Math.round(
      num(r.popularityRoot, DEFAULT_MAP.popularityRoot, POPULARITY_ROOT_MIN, POPULARITY_ROOT_MAX) * 100,
    ) / 100,
    placesShown: Math.round(
      num(r.placesShown, DEFAULT_MAP.placesShown, MAP_PLACES_SHOWN_MIN, MAP_PLACES_SHOWN_MAX),
    ),
    dotsShown: Math.round(
      num(r.dotsShown, DEFAULT_MAP.dotsShown, MAP_DOTS_SHOWN_MIN, MAP_DOTS_SHOWN_MAX),
    ),
    catalogPageSize: Math.round(
      num(r.catalogPageSize, DEFAULT_MAP.catalogPageSize, CATALOG_PAGE_SIZE_MIN, CATALOG_PAGE_SIZE_MAX),
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
/** One bounded value that reports: absent → the fallback, silently; not a
 *  number (null included) → the fallback, reported; out of bounds →
 *  clamped, reported. Rounded to the field's decimals either way. */
function reportedParam(
  raw: unknown,
  fallback: number,
  b: { min: number; max: number; decimals: number },
  key: string,
  onClamp?: OnClamp,
): number {
  const factor = 10 ** b.decimals;
  if (raw === undefined) return Math.round(fallback * factor) / factor;
  const n = typeof raw === "number" ? raw : (raw === null || raw === "" ? Number.NaN : Number(raw));
  if (!Number.isFinite(n)) {
    onClamp?.(key, raw);
    return Math.round(fallback * factor) / factor;
  }
  if (n < b.min || n > b.max) onClamp?.(key, raw);
  return Math.round(Math.min(b.max, Math.max(b.min, n)) * factor) / factor;
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

/**
 * The recipe rows (MESITA-4454, MESITA-4517, MESITA-4548). A missing row or field reads the
 * recipe table. Map rows have no Proximity: their `halfKm` and
 * `distanceExp` are always null. A Catalog row's null distance number reads
 * its default and is reported (L-1). Every Organic row's Premier exponent is
 * 0 whatever is stored (C1): a plan never moves the organic list.
 */
export function normalizeRecipes(raw: unknown, onClamp?: OnClamp): Recipes {
  const r = asRecord(raw);
  const out = {} as Recipes;
  for (const row of RECIPE_ROWS) {
    const v = asRecord(r[row] !== undefined ? r[row] : legacyRow(row, r));
    const d = DEFAULT_RECIPES[row];
    const key = (f: string) => `params.recipes.${row}.${f}`;
    const map = isMapRow(row);
    out[row] = {
      halfKm: map ? null : reportedParam(v.halfKm, d.halfKm as number, RECIPE_BOUNDS.halfKm, key("halfKm"), onClamp),
      distanceExp: map
        ? null
        : reportedParam(v.distanceExp, d.distanceExp as number, RECIPE_BOUNDS.distanceExp, key("distanceExp"), onClamp),
      googleExp: reportedParam(v.googleExp, d.googleExp, RECIPE_BOUNDS.googleExp, key("googleExp"), onClamp),
      foursquareFactor: reportedParam(
        v.foursquareFactor,
        d.foursquareFactor,
        RECIPE_BOUNDS.foursquareFactor,
        key("foursquareFactor"),
        onClamp,
      ),
      foursquareExponent: reportedParam(
        v.foursquareExponent,
        d.foursquareExponent,
        RECIPE_BOUNDS.foursquareExponent,
        key("foursquareExponent"),
        onClamp,
      ),
      premierExp: isOrganicRow(row)
        ? 0
        : reportedParam(v.premierExp, d.premierExp, RECIPE_BOUNDS.premierExp, key("premierExp"), onClamp),
      batch: map ? null : reportedParam(v.batch, d.batch as number, RECIPE_BOUNDS.batch, key("batch"), onClamp),
    };
  }
  return out;
}

/** `params.mix` (MESITA-4454); a missing key reads its default. */
export function normalizeMix(raw: unknown, onClamp?: OnClamp): MixParams {
  const r = asRecord(raw);
  const t = asRecord(r.temperature);
  const temp = (mode: RankMode) =>
    reportedParam(t[mode], DEFAULT_MIX.temperature[mode], MIX_BOUNDS.temperature, `params.mix.temperature.${mode}`, onClamp);
  return {
    temperature: { nearby: temp("nearby"), family: temp("family"), popular: temp("popular") },
    adEvery: reportedParam(r.adEvery, DEFAULT_MIX.adEvery, MIX_BOUNDS.adEvery, "params.mix.adEvery", onClamp),
    proFactor: reportedParam(r.proFactor, DEFAULT_MIX.proFactor, MIX_BOUNDS.proFactor, "params.mix.proFactor", onClamp),
    maxFactor: reportedParam(r.maxFactor, DEFAULT_MIX.maxFactor, MIX_BOUNDS.maxFactor, "params.mix.maxFactor", onClamp),
    growthWeightCap: reportedParam(
      r.growthWeightCap,
      DEFAULT_MIX.growthWeightCap,
      MIX_BOUNDS.growthWeightCap,
      "params.mix.growthWeightCap",
      onClamp,
    ),
  };
}

export function normalizeSignalParams(raw: unknown, onClamp?: OnClamp): SignalParams {
  const r = (raw ?? {}) as Record<string, unknown>;
  const prox = (r.proximity ?? {}) as Record<string, unknown>;
  const pop = (r.popularity ?? {}) as Record<string, unknown>;
  const shuffle = (r.shuffle ?? {}) as Record<string, unknown>;
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
      starsPower: boundedParam(
        pop.starsPower,
        d.popularity.starsPower,
        SIGNAL_PARAM_BOUNDS.starsPower,
      ),
    },
    shuffle: {
      temperature: boundedParam(
        shuffle.temperature,
        d.shuffle.temperature,
        SIGNAL_PARAM_BOUNDS.temperature,
      ),
    },
    recipes: normalizeRecipes(asRecord(raw).recipes, onClamp),
    mix: normalizeMix(asRecord(raw).mix, onClamp),
  };
}

/**
 * Tolerant read: any missing or invalid key falls back to its default, and
 * the top-level blob is rebuilt key by key, so a retired top-level key
 * (`weights`, `weightsByMode`, `engines`, `swipe`, MESITA-2328; `filters`,
 * MESITA-2337; the rails engine's `catalog`, MESITA-2923) is dropped on the
 * next save rather than lingering in jsonb forever.
 *
 * Under `params` and `map` the raw object is spread first and the typed keys
 * overlaid (H-2, MESITA-4454): a key this build does not know survives a read
 * and a save, so an older build can never erase `params.recipes` or
 * `params.mix`, and a retired key waits for the migration that deletes it.
 * `onClamp` hears every stored value the recipe or mix normalizer had to
 * replace (DX-f).
 */
export function normalizeDiscoveryConfig(raw: unknown, onClamp?: OnClamp): DiscoveryConfig {
  const r = asRecord(raw);

  return {
    params: { ...asRecord(r.params), ...normalizeSignalParams(r.params, onClamp) },
    general: normalizeGeneralConfig(r.general),
    map: { ...asRecord(r.map), ...normalizeMapConfig(r.map) },
    name: normalizeNameConfig(r.name),
    deep: normalizeDeepConfig(r.deep),
    chat: {
      prompt: normalizeChatPrompt(
        asRecord(r.chat).prompt,
      ),
    },
    premier: normalizePremierConfig(r.premier),
    social: normalizeSocialConfig(r.social),
  };
}

/** A config read with its row's `updated_at` (the rank response's
 *  `updatedAt`, DX-b) and every value the normalizer replaced. */
export type LoadedDiscoveryConfig = {
  cfg: DiscoveryConfig;
  updatedAt: string | null;
  clamped: Array<{ key: string; raw: unknown }>;
};

/**
 * Load the live config, or the defaults if the row cannot be read.
 *
 * An engine must never fail to serve a deck because a config read failed —
 * falling back to defaults degrades the ordering, while throwing would empty
 * the guest's screen. The read error is logged, not raised.
 */
export async function loadDiscoveryConfigWithMeta(
  admin: SupabaseClient,
): Promise<LoadedDiscoveryConfig> {
  const clamped: Array<{ key: string; raw: unknown }> = [];
  try {
    const { data, error } = await admin
      .from("app_config")
      .select("discovery_config, updated_at")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      console.error("[discovery-config] read:", error.message);
      return { cfg: DISCOVERY_DEFAULTS, updatedAt: null, clamped };
    }
    const row = (data ?? null) as { discovery_config?: unknown; updated_at?: unknown } | null;
    return {
      cfg: normalizeDiscoveryConfig(row?.discovery_config, (key, raw) => clamped.push({ key, raw })),
      updatedAt: typeof row?.updated_at === "string" ? row.updated_at : null,
      clamped,
    };
  } catch (e) {
    console.error("[discovery-config] read threw:", errorMessage(e));
    return { cfg: DISCOVERY_DEFAULTS, updatedAt: null, clamped };
  }
}

/** `loadDiscoveryConfigWithMeta` for a caller that needs the config only. */
export async function loadDiscoveryConfig(
  admin: SupabaseClient,
): Promise<DiscoveryConfig> {
  return (await loadDiscoveryConfigWithMeta(admin)).cfg;
}

/** The recipe row a screen, mode and lane read (M-f, MESITA-4454). `map`
 *  is the Map's pair (Popular and Family share it); no mode resolves to
 *  popular (the place screen's score). A cfg that predates the rows reads
 *  the recipe table. */
export function recipeFor(
  mode: RankMode | "map" | undefined,
  lane: "organic" | "inorganic",
  cfg: { params: Pick<SignalParams, "recipes"> | SignalParams },
): Recipe {
  const m = mode ?? "popular";
  const L = lane === "organic" ? "Organic" : "Inorganic";
  // Family is three lanes (MESITA-4517), each with its own Inorganic row
  // (MESITA-4548); a caller that asks for one row (Chat, a card with no
  // lane) reads Family well known, or Family close Inorganic.
  const row = (m === "map"
    ? `map${L}`
    : m === "family"
    ? (lane === "organic" ? "catalogFamilyWellKnown" : "catalogFamilyCloseInorganic")
    : `catalog${m[0].toUpperCase()}${m.slice(1)}${L}`) as RecipeRow;
  return recipeRow(row, cfg);
}

/** One named row, or the recipe table's when a cfg predates it. */
export function recipeRow(
  row: RecipeRow,
  cfg: { params: Pick<SignalParams, "recipes"> | SignalParams },
): Recipe {
  return cfg.params?.recipes?.[row] ?? DEFAULT_RECIPES[row];
}

/** A Catalog lane's batch: the row's, else 10 (MESITA-4517). */
export function laneBatch(recipe: Recipe): number {
  const b = recipe.batch;
  return typeof b === "number" && Number.isFinite(b) && b >= 1 ? Math.floor(b) : LANE_BATCH_DEFAULT;
}

/** The factor each `boost_tier` (0 free, 1 Pro, 2 Max) earns, from the
 *  saved mix (MESITA-5028); a cfg that predates the two keys reads 2 and 5. */
export function premierFactors(cfg: { params: Partial<Pick<SignalParams, "mix">> }): Record<0 | 1 | 2, number> {
  const mix = mixFor(cfg);
  return { 0: 1, 1: mix.proFactor ?? PREMIER_FACTOR[1], 2: mix.maxFactor ?? PREMIER_FACTOR[2] };
}

/** The mix, or its defaults on a cfg that predates it. */
export function mixFor(cfg: { params: Partial<Pick<SignalParams, "mix">> }): MixParams {
  return cfg.params?.mix ?? DEFAULT_MIX;
}

/**
 * Premier's yearly prices for a quote that becomes a charge (MESITA-3043).
 * Unlike `loadDiscoveryConfig` this never falls back on a failed read: a
 * guest shown or charged a default the operator replaced would be paying a
 * price nobody set, so the caller answers 500 instead.
 */
export async function loadPremierPrices(admin: SupabaseClient): Promise<PremierPrices> {
  const { data, error } = await admin
    .from("app_config")
    .select("discovery_config")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(`premier_prices: ${error.message}`);
  const raw = (data?.discovery_config ?? {}) as Record<string, unknown>;
  return normalizePremierConfig(raw.premier).yearlyCents;
}
