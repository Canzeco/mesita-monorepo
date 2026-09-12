// Discovery config — the operator's half of the ranking model (Docs ›
// Discovery §A, MESITA-1196).
//
// Keys: weights · params · slotting · filters · engines · general · catalog · map · name · social · chat · swipe.
// Admin: Modes (Fast + Deep + Map live; Swipe ranks via Lineup; Home Soon) · Modules (Google types,
// three Google boxes, Places Lineup, Social Lineup Soon, Perplexity Soon).
// `params` rides with `weights` — same Lineup table, different numbers.
//
//   weights    one exponent per earned signal (`w` in `s^w`).
//   params     shape numbers. The console edits maxKm and closedFloor;
//              the rest stay on the blob as the function's defaults.
//   slotting   the bought lane: whether promoting places get slots at all, and
//              how often. A position pass, not the Promotion weight.
//   filters    what may ENTER the pool at all. The counterpart to a signal, and
//              the distinction is the whole reason both exist: a SIGNAL
//              DEMOTES, a FILTER EXCLUDES. A signal can only ever reorder
//              places a filter already admitted.
//   engines    which surfaces read any of the above.
//   general    Discovery-wide. requireActive + minReviews — the post-Google
//              wipe every mode runs on what a Google Places query returned
//              (discovery-general-gate.ts). The category param is NOT here:
//              it is `supers` on each Google-calling engine (MESITA-1695).
//   chat       Concierge system prompt. Blank → in-code persona (memo-prompt.ts).
//
// FILTERS ARE NOT THE TORN-DOWN FILTER SURFACE. MESITA-1183 deleted a
// GUEST-facing one — "what may a guest exclude" — and that tombstone stands.
// These are OPERATOR pool policy: catalog-wide admission rules a guest never
// sees and cannot express. Different question, different owner, and the old
// blob is deliberately not inherited (see the note at the bottom).
//
// The vocabulary is CODE-DEFINED, the same contract as channels.ts and
// enrich-triggers.ts: the console edits numbers, never the list of signals.
// SIGNAL_KEYS in discovery-signals.ts is the list, and normalize() rebuilds
// the blob against it on every read and every write — so a signal added in
// code appears with its default, and a key left over from a retired one is
// dropped on the next save rather than lingering in jsonb forever.
//
// THIS BLOB DELIBERATELY DOES NOT INHERIT `filters_config`. That column was
// dropped in MESITA-1183 and its shape encoded the old six-filter-module model
// — a different question (what may a guest exclude) from this one (how is the
// remainder ordered). The teardown migration says as much in its own comment.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { GOOGLE_SEARCH_TYPES } from "./google-type-super.ts";
import {
  CATEGORY_EXACT,
  CATEGORY_FAMILY,
  CATEGORY_MISS,
  DAYPART_BREAKFAST,
  DAYPART_DAWN,
  DAYPART_DEAD,
  DAYPART_EVENING,
  DAYPART_LATE,
  DAYPART_MIDDAY,
  POPULARITY_CONFIDENCE,
  POPULARITY_FLOOR_RATING,
  POPULARITY_PRIOR_RATING,
  PROXIMITY_KNEE_KM,
  PROXIMITY_MAX_KM,
  NAME_UNEMBEDDED,
  SUMMARY_UNEMBEDDED,
  SIGNAL_KEYS,
  TIMING_CLOSED_FLOOR,
  TIMING_OPEN_SHARE,
  type SignalKey,
  type SignalParamBag,
} from "./discovery-signals.ts";
import { num, bool } from "./config-coerce.ts";

export type SignalParams = Record<SignalKey, SignalParamBag>;

export type CatalogConfig = {
  /** Atlas category rails that currently have inventory. */
  seedCount: number;
  /** Vibe-query rails, sampled from the code-defined bank (not Atlas slugs). */
  generatedCount: number;
  placesPerRail: number;
  /** Seed category must have at least this many listed places. */
  minSeedPlaces: number;
};

/** Tentative Social engine. Queries events at places, not places. No reader yet. */
export type SocialConfig = {
  seedCount: number;
  generatedCount: number;
  eventsPerRail: number;
  minSeedEvents: number;
  /** Look-ahead window. Events expire; places do not. */
  horizonDays: number;
};

/**
 * Google Nearby primary types the map asks for. Off = absent from the
 * `includedPrimaryTypes` array, NOT a skipped call: `searchNearbyOnce`
 * (nearby-places.ts) sends ONE POST carrying every enabled type, and Google
 * Places Nearby (New) bills per REQUEST. Twenty-two types cost what five do.
 * These toggles shape one call's RESULT SET; they never change call count.
 *
 * ONE ENTRY PER TYPE IN `GOOGLE_SEARCH_TYPES`, in that object's own order, so
 * the strip covers all SEVEN Super Categories rather than the three it knew
 * when it was five keys long (MESITA-1683). `google-type-super.test.ts` pins
 * this list to that map: the taxonomy is the law, this is its value today.
 *
 * THIS IS THE WIRE LIST, NOT THE PARAM. Since MESITA-1695 the operator toggles
 * SUPERS (`SUPER_PARAM_KEYS`) and the battery is derived by
 * `nearbyTypesForSupers`. Nothing reads this list positionally any more.
 */
export const NEARBY_TYPE_KEYS = [
  // restaurants
  "restaurant",
  // bars_nightlife
  "bar",
  "night_club",
  // cafes_bakeries
  "cafe",
  "bakery",
  // sports_fitness
  "gym",
  "fitness_center",
  "yoga_studio",
  "sports_club",
  // wellness_beauty
  "spa",
  "beauty_salon",
  "hair_salon",
  "massage",
  // experiences
  "tourist_attraction",
  "amusement_park",
  "bowling_alley",
  "park",
  "movie_theater",
  // culture_arts
  "museum",
  "art_gallery",
  "performing_arts_theater",
  "concert_hall",
] as const;
export type NearbyTypeKey = (typeof NEARBY_TYPE_KEYS)[number];

/**
 * THE OPERATOR'S CATEGORY PARAM (Pato, 2026-09-08, MESITA-1695): the seven
 * guest Super Categories, in `SUPER_CATEGORIES` sort order — the same seven,
 * in the same order, the guest sees as pills on the Filters sheet.
 *
 * Google's own type slugs are not a param. Twenty-two switches asked the
 * operator to think in Google's vocabulary, and the ordered "first N" cap on
 * top of them (`general.categoryCount`, now deleted) silently forced four
 * whole Supers off. One Super on = its whole `GOOGLE_SEARCH_TYPES` battery on.
 *
 * Super `undefined` is NOT here: its battery is empty, so a toggle for it
 * could never change a Google call. `google-type-super.test.ts` pins this list
 * to the taxonomy.
 */
export const SUPER_PARAM_KEYS = [
  "restaurants",
  "cafes_bakeries",
  "bars_nightlife",
  "experiences",
  "culture_arts",
  "sports_fitness",
  "wellness_beauty",
] as const;
export type SuperParamKey = (typeof SUPER_PARAM_KEYS)[number];

/**
 * Map pool policy. Closest N of the selected Places set, then paint.
 * THREE NESTED SETS (Pato, 2026-09-05):
 *   Google Places ⊃ Mesita Enriched Places ⊃ Mesita Partner Places
 * Enrichment gates every Mesita ring, so a partner has to be enriched to
 * sit inside the enriched one. N is `pinCount`, an OPERATOR number since
 * MESITA-1699 — the guest's Filters sheet is gone and its three controls
 * live here and on Search Sources. Floors still exclude; 0 = off.
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
   * consumer app." It caps BOTH lanes and the merged union, so max pins =
   * pinCount, never the sum. Distinct from `googlePull`, which caps only how
   * many GOOGLE rows we are willing to pay for.
   */
  pinCount: number;
  /**
   * Max places one Nearby pull asks Google for: 20, 40 or 60 (`GOOGLE_PULL_STOPS`).
   * Google bills in pages of 20; 40 and 60 are 2 and 3 billed requests over the
   * same query (Legacy next_page_token). Pull 20 stays one Nearby Search (New)
   * POST. Operator spend knob; `pinCount` caps painted pins.
   */
  googlePull: number;
};

/**
 * Name = two Search-bar boxes. Map Filters never cut this list.
 *   Fast  Autocomplete. googleCount + count (same cap — count is symmetry).
 *   Deep  Four query caps, then concat. Autocomplete → Text → Mesita Places
 *         → Mesita Partners. Overlaps drop. googleCount is Text Search.
 */
export type NameFastConfig = {
  /** Redundant with count on Fast — one source. Locked together. */
  googleCount: number;
  count: number;
  supers: Record<SuperParamKey, boolean>;
};

export type NameDeepConfig = {
  partnerCount: number;
  mesitaCount: number;
  /** Google Autocomplete cap. Independent query. */
  autoCount: number;
  /** Google Text Search cap. Independent query. */
  googleCount: number;
  /** Legacy blob field. Queries concat; the union is not sliced. */
  count: number;
  supers: Record<SuperParamKey, boolean>;
};

export type NameConfig = {
  fast: NameFastConfig;
  deep: NameDeepConfig;
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

export type SwipePartnerLevel =
  | "none"
  | "partner"
  | "conservative"
  | "aggressive"
  | "dominant";

export type SwipePartnerBias = Record<SwipePartnerLevel, number>;

/**
 * Swipe admission knobs. Radius, reviews, closing buffer, and type-adjacent
 * flags cut the pool. Ranking is Places Lineup under the Swipe mask
 * (`weights` / `params`). weightProximity, starsExponent, logDivisor,
 * partnerBias, and randomnessMax stay on the blob, unread.
 */
export type SwipeConfig = {
  radiusKm: number;
  closingBufferMin: number;
  /** Popularity weight is 1 minus this. */
  weightProximity: number;
  starsExponent: number;
  logDivisor: number;
  partnerBias: SwipePartnerBias;
  /**
   * High end of a per-place Uniform[1, max] multiplier after bias.
   * 1 = off. Stops the deck freezing the same order every load.
   */
  randomnessMax: number;
  /** Guest category-filter default. Off keeps the feed open. */
  categoryFilter: boolean;
  minReviews: number;
  /** ISO time of the last Swipe-slice save. Null until the first Save. */
  savedAt: string | null;
};

export type DiscoveryConfig = {
  weights: Record<SignalKey, number>;
  params: SignalParams;
  slotting: {
    enabled: boolean;
    everyNth: number;
  };
  filters: DiscoveryFilters;
  engines: Record<WiredEngineKey, { ranked: boolean }>;
  general: GeneralConfig;
  catalog: CatalogConfig;
  map: MapConfig;
  name: NameConfig;
  social: SocialConfig;
  chat: { prompt: string };
  swipe: SwipeConfig;
};

/** Ceiling for discovery_config.chat.prompt. The console textarea matches it. */
export const CHAT_PROMPT_MAX = 12_000;

/**
 * Pool admission. EVERY ONE OF THESE MUST BE EXPRESSIBLE AS A QUERY PREDICATE.
 *
 * That is not a style preference. The pool is capped at POOL_CAP before
 * anything ranks, so a filter applied AFTER the fetch does not narrow the
 * catalog — it thins the page the guest actually receives, silently, and the
 * deck gets shorter instead of better. Anything that cannot be pushed into the
 * WHERE clause does not belong in this box.
 */
export type DiscoveryFilters = {
  /** `content_state = 'ready'` — the enrichment gate MESITA-1228 hardcoded. */
  requireReady: boolean;
  /** Google stars floor. 0 = off. Above 0 EXCLUDES unrated places — see below. */
  minRating: number;
  /** Google review-count floor. 0 = off. */
  minReviews: number;
  /** Hard radius in km. 0 = off, and off is the default — see below. */
  maxDistanceKm: number;
};

/**
 * Engines that actually read the signal library today. CODE-DEFINED: an engine
 * only earns a key here when it is wired, so the console can never offer a
 * toggle over an engine that would ignore it.
 */
export const WIRED_ENGINE_KEYS = ["swipe"] as const;
export type WiredEngineKey = (typeof WIRED_ENGINE_KEYS)[number];

/**
 * An exponent's legal range. The ceiling is 4 because s^4 already drives
 * anything below 0.85 under a tenth — past that the signal is not "important",
 * it is a filter, and filters are not what this model is. The floor is 0,
 * which means OFF.
 */
export const WEIGHT_MIN = 0;
export const WEIGHT_MAX = 4;

/**
 * Per-signal ceilings, for the signals the uniform WEIGHT_MAX is wrong for.
 *
 * The 4 above is reasoned from a signal that floors around 0.85. `mesita_level`
 * floors at LEVEL_LISTED = 0.04, so the same exponent means something else
 * entirely: the promoting-over-listed ratio is (1 / 0.04)^w = 25^w.
 *
 *   w = 1   25x
 *   w = 2   625x        the ceiling (Pato, MESITA-1410)
 *   w = 4   390,625x    the uniform WEIGHT_MAX
 *
 * Every other signal is bounded in (0, 1] and abstains at 1, so at w = 4 there
 * is no combination of relevance that can outrank money — Level stops being a
 * signal and becomes a sort key. By the WEIGHT_MAX comment's own test ("past
 * that the signal is not important, it is a filter"), Level is filter-shaped at
 * a far lower exponent than the other seven.
 *
 * WHY 2 (Pato, MESITA-1410). At the time of this decision Level was entirely
 * bought: `plan` is money and `promoting` is only true if the place pays, so
 * turning its weight up was turning money up. At the uniform ceiling of 4 the
 * floor rung becomes 0.04^4 ≈ 0.0000026 — a ~390,000x demotion that
 * mathematically erases a non-paying place from ranking regardless of its
 * other signals, a pay-to-win filter rather than a tunable importance weight.
 * 2 (0.04^2 = 0.0016, a 625x demotion) keeps Level tunable and meaningful
 * without letting it fully override the rest of the blend. The rungs
 * themselves (LEVEL_LISTED / LEVEL_PARTNER / LEVEL_PROMOTING) are unchanged —
 * this caps the exponent only.
 *
 * NO LONGER FULLY MONEY (MESITA-1598, item 3). Level now also reads Intake
 * high-water — a well-enriched free place can outrank a paying place with a
 * thin profile — on the surfaces wired to fetch it (discovery-signals.ts's
 * `mesitaLevel`). The reasoning above still holds structurally: the money
 * RUNGS this ceiling bounds are unchanged, only each rung's own honesty
 * changed. Item 2 (whether LEVEL_LISTED itself should move) is separately
 * still open.
 */
export const SIGNAL_WEIGHT_MAX: Partial<Record<SignalKey, number>> = {
  mesita_level: 2,
};

/** The ceiling that actually applies to one signal's exponent. */
export function weightMaxFor(key: SignalKey): number {
  return SIGNAL_WEIGHT_MAX[key] ?? WEIGHT_MAX;
}

/** Bought slots can never be denser than every other card. */
export const SLOT_MIN_EVERY_NTH = 2;
export const SLOT_MAX_EVERY_NTH = 50;

export const MIN_RATING_MAX = 5;
/** A radius past this is not a filter, it is the whole catalog. */
export const MAX_DISTANCE_KM_MAX = 200;

export const CATALOG_COUNT_MAX = 20;
export const CATALOG_PLACES_PER_RAIL_MIN = 4;
export const CATALOG_PLACES_PER_RAIL_MAX = 20;
export const CATALOG_MIN_SEED_PLACES_MAX = 20;
export const CATALOG_RAILS_CAP = 24;

export const SOCIAL_COUNT_MAX = 20;
export const SOCIAL_EVENTS_PER_RAIL_MIN = 4;
export const SOCIAL_EVENTS_PER_RAIL_MAX = 20;
export const SOCIAL_MIN_SEED_EVENTS_MAX = 20;
export const SOCIAL_HORIZON_DAYS_MIN = 1;
export const SOCIAL_HORIZON_DAYS_MAX = 90;
export const SOCIAL_RAILS_CAP = 24;

export const MAP_MIN_POPULARITY_MAX = 1;
export const MAP_RELOAD_MIN_KM_MIN = 0.25;
export const MAP_RELOAD_MIN_KM_MAX = 4;
export const MAP_RELOAD_MIN_SEC_MIN = 1;
export const MAP_RELOAD_MIN_SEC_MAX = 15;
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

export const NAME_LANE_COUNT_MAX = 20;
export const NAME_FAST_COUNT_DEFAULT = 5;
export const NAME_PARTNER_COUNT_DEFAULT = 3;
export const NAME_MESITA_COUNT_DEFAULT = 3;
export const NAME_GOOGLE_COUNT_DEFAULT = 3;
export const NAME_DEEP_COUNT_DEFAULT = 9;
/**
 * The three stops the Nearby box offers. 20 is one Google request; 40 and 60
 * are 2 and 3, because Nearby Search (New) caps `maxResultCount` at 20 and
 * has no page token (`GOOGLE_NEARBY_MAX` in nearby-places.ts). Picking 60
 * therefore triples that lane's Nearby bill.
 */
export const GOOGLE_PULL_STOPS = [20, 40, 60] as const;
export const GOOGLE_PULL_DEFAULT = 20;
/** Same ceiling as filters.minReviews — one review floor reads like another. */
export const GENERAL_MIN_REVIEWS_MAX = 100_000;

export const SWIPE_RADIUS_KM_MIN = 1;
export const SWIPE_RADIUS_KM_MAX = 50;
export const SWIPE_CLOSING_BUFFER_MIN = 0;
export const SWIPE_CLOSING_BUFFER_MAX = 180;
export const SWIPE_STARS_EXPONENT_MIN = 1;
export const SWIPE_STARS_EXPONENT_MAX = 3;
export const SWIPE_LOG_DIVISOR_MIN = 1;
export const SWIPE_LOG_DIVISOR_MAX = 20;
export const SWIPE_PARTNER_BIAS_MIN = 1;
export const SWIPE_PARTNER_BIAS_MAX = 2;
export const SWIPE_RANDOMNESS_MAX_MIN = 1;
export const SWIPE_RANDOMNESS_MAX_MAX = 2;
export const SWIPE_PARTNER_LEVELS = [
  "none",
  "partner",
  "conservative",
  "aggressive",
  "dominant",
] as const satisfies readonly SwipePartnerLevel[];

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
  restaurants: true,
  cafes_bakeries: true,
  bars_nightlife: true,
  experiences: false,
  culture_arts: false,
  sports_fitness: false,
  wellness_beauty: false,
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
  googlePull: GOOGLE_PULL_DEFAULT,
  pinCount: GOOGLE_PULL_DEFAULT,
};

export const DEFAULT_CATALOG: CatalogConfig = {
  seedCount: 8,
  generatedCount: 8,
  placesPerRail: 8,
  minSeedPlaces: 2,
};

export const DEFAULT_SOCIAL: SocialConfig = {
  seedCount: 6,
  generatedCount: 6,
  eventsPerRail: 8,
  minSeedEvents: 1,
  horizonDays: 14,
};

export const DEFAULT_NAME_FAST: NameFastConfig = {
  googleCount: NAME_FAST_COUNT_DEFAULT,
  count: NAME_FAST_COUNT_DEFAULT,
  supers: DEFAULT_MAP_SUPERS,
};

export const DEFAULT_NAME_DEEP: NameDeepConfig = {
  partnerCount: NAME_PARTNER_COUNT_DEFAULT,
  mesitaCount: NAME_MESITA_COUNT_DEFAULT,
  autoCount: NAME_GOOGLE_COUNT_DEFAULT,
  googleCount: NAME_GOOGLE_COUNT_DEFAULT,
  count: NAME_DEEP_COUNT_DEFAULT,
  supers: DEFAULT_MAP_SUPERS,
};

export const DEFAULT_NAME: NameConfig = {
  fast: DEFAULT_NAME_FAST,
  deep: DEFAULT_NAME_DEEP,
};

export const DEFAULT_GENERAL: GeneralConfig = {
  // ON by default (Pato, 2026-08-29). A closed place is not a search
  // result, and the live blob predates the key — so the default is what
  // every surface reads until the operator says otherwise.
  requireActive: true,
  minReviews: 0,
};

export const DEFAULT_SWIPE_PARTNER_BIAS: SwipePartnerBias = {
  none: 1,
  partner: 1.25,
  conservative: 1.5,
  aggressive: 1.75,
  dominant: 2,
};

/** Closing buffer 30 min — discussed, not settled; operator-editable. */
export const DEFAULT_SWIPE: SwipeConfig = {
  radiusKm: 5,
  closingBufferMin: 30,
  weightProximity: 0.7,
  starsExponent: 1.5,
  logDivisor: 10,
  partnerBias: DEFAULT_SWIPE_PARTNER_BIAS,
  randomnessMax: 1.3,
  categoryFilter: false,
  minReviews: 1,
  savedAt: null,
};

/**
 * Defaults: every earned signal at 1 — its own number, unmodified — except
 * Randomness, which ships at 0.35 so it softens into a tiebreak instead of
 * shuffling the deck. Starting flat is the honest position: nothing has been
 * measured yet, and a fabricated weighting would look like a finding.
 *
 * Slotting ships ENABLED at every 5th card. Zero would be a lie about the
 * business — places do buy strategies today — and shipping it off would make
 * the bought lane dead code nobody notices is broken.
 */
/**
 * Default shape numbers. These are the same constants the signal functions
 * fall back to, so a blob with no `params` scores identically to yesterday.
 */
export const DEFAULT_SIGNAL_PARAMS: SignalParams = {
  proximity: { maxKm: PROXIMITY_MAX_KM, kneeKm: PROXIMITY_KNEE_KM, missingGeo: 0.35 },
  timing: {
    openShare: TIMING_OPEN_SHARE,
    closedFloor: TIMING_CLOSED_FLOOR,
    dead: DAYPART_DEAD,
    dawn: DAYPART_DAWN,
    breakfast: DAYPART_BREAKFAST,
    midday: DAYPART_MIDDAY,
    evening: DAYPART_EVENING,
    late: DAYPART_LATE,
  },
  category: { exact: CATEGORY_EXACT, family: CATEGORY_FAMILY, miss: CATEGORY_MISS },
  popularity: {
    priorRating: POPULARITY_PRIOR_RATING,
    confidence: POPULARITY_CONFIDENCE,
    floorRating: POPULARITY_FLOOR_RATING,
  },
  name: { unembedded: NAME_UNEMBEDDED },
  summary: { unembedded: SUMMARY_UNEMBEDDED },
  mesita_level: {},
  randomness: {},
};

/** Legal ranges for every param the console may edit. */
export const SIGNAL_PARAM_BOUNDS: Record<
  SignalKey,
  Record<string, { min: number; max: number; decimals: number }>
> = {
  proximity: {
    maxKm: { min: 1, max: 200, decimals: 1 },
    kneeKm: { min: 0.1, max: 25, decimals: 2 },
    missingGeo: { min: 0, max: 1, decimals: 2 },
  },
  timing: {
    openShare: { min: 0, max: 1, decimals: 2 },
    closedFloor: { min: 0, max: 1, decimals: 2 },
    dead: { min: 0, max: 1, decimals: 2 },
    dawn: { min: 0, max: 1, decimals: 2 },
    breakfast: { min: 0, max: 1, decimals: 2 },
    midday: { min: 0, max: 1, decimals: 2 },
    evening: { min: 0, max: 1, decimals: 2 },
    late: { min: 0, max: 1, decimals: 2 },
  },
  category: {
    exact: { min: 0, max: 1, decimals: 2 },
    family: { min: 0, max: 1, decimals: 2 },
    miss: { min: 0, max: 1, decimals: 2 },
  },
  popularity: {
    priorRating: { min: 0, max: 5, decimals: 2 },
    confidence: { min: 1, max: 1000, decimals: 0 },
    floorRating: { min: 0, max: 4.9, decimals: 2 },
  },
  name: {
    unembedded: { min: 0, max: 1, decimals: 2 },
  },
  summary: {
    unembedded: { min: 0, max: 1, decimals: 2 },
  },
  mesita_level: {},
  randomness: {},
};

export const DISCOVERY_DEFAULTS: DiscoveryConfig = {
  weights: {
    proximity: 1,
    timing: 1,
    category: 1,
    popularity: 1,
    name: 1,
    summary: 1,
    mesita_level: 1,
    randomness: 0.35,
  },
  params: DEFAULT_SIGNAL_PARAMS,
  slotting: {
    enabled: true,
    everyNth: 5,
  },
  /**
   * `requireReady` ships ON because it is already the shipped behaviour —
   * MESITA-1228 hardcoded it into Map and Swipe. Adopting a live gate at its
   * current value is the only default that changes nothing on landing.
   *
   * The quality floors ship OFF. Popularity already DEMOTES a weak place, and
   * a floor on top of it would delete the same place twice over — the reason
   * the two boxes are separate is that an operator should choose which one
   * they mean. They also exclude places with NO rating at all, which in a
   * young catalog is most of them.
   *
   * `maxDistanceKm` ships OFF for the same reason, and one more: Proximity
   * already bends distance through a log curve, so a hard radius is the model
   * MESITA-1183 tore down. It exists for the operator who genuinely wants a
   * city boundary, not as the default way distance is handled.
   */
  filters: {
    requireReady: true,
    minRating: 0,
    minReviews: 0,
    maxDistanceKm: 0,
  },
  engines: {
    swipe: { ranked: true },
  },
  general: DEFAULT_GENERAL,
  catalog: DEFAULT_CATALOG,
  map: DEFAULT_MAP,
  name: DEFAULT_NAME,
  social: DEFAULT_SOCIAL,
  chat: { prompt: "" },
  swipe: DEFAULT_SWIPE,
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

export function normalizeSocialConfig(raw: unknown): SocialConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    seedCount: Math.round(
      num(r.seedCount, DEFAULT_SOCIAL.seedCount, 0, SOCIAL_COUNT_MAX),
    ),
    generatedCount: Math.round(
      num(r.generatedCount, DEFAULT_SOCIAL.generatedCount, 0, SOCIAL_COUNT_MAX),
    ),
    eventsPerRail: Math.round(
      num(
        r.eventsPerRail,
        DEFAULT_SOCIAL.eventsPerRail,
        SOCIAL_EVENTS_PER_RAIL_MIN,
        SOCIAL_EVENTS_PER_RAIL_MAX,
      ),
    ),
    minSeedEvents: Math.round(
      num(
        r.minSeedEvents,
        DEFAULT_SOCIAL.minSeedEvents,
        1,
        SOCIAL_MIN_SEED_EVENTS_MAX,
      ),
    ),
    horizonDays: Math.round(
      num(
        r.horizonDays,
        DEFAULT_SOCIAL.horizonDays,
        SOCIAL_HORIZON_DAYS_MIN,
        SOCIAL_HORIZON_DAYS_MAX,
      ),
    ),
  };
}

export function normalizeChatPrompt(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.slice(0, CHAT_PROMPT_MAX);
}

/**
 * The five Google slugs the strip defaulted ON before MESITA-1683 grew the
 * list and MESITA-1695 replaced it. A tombstone, read only when folding a
 * stored blob that predates the Super params.
 */
const LEGACY_TYPE_DEFAULTS = new Set<string>([
  "restaurant",
  "bar",
  "night_club",
  "cafe",
  "bakery",
]);

/**
 * The seven Super params, with the pre-MESITA-1695 blob folded in.
 *
 * A stored blob written before the rename carries `types`, keyed by Google
 * slug. A Super is on iff ANY slug in its battery was on, which reproduces the
 * live blob exactly: it held `restaurant, bar, night_club, cafe, bakery` true
 * and `categoryCount: 5`, which forced every other key off anyway. The blob is
 * jsonb normalized on every read, so there is no migration to run.
 *
 * Half a Super was never reachable: no console ever shipped a control that
 * could turn `cafe` on and `bakery` off, so ANY is the honest fold.
 */
export function normalizeSuperParams(
  raw: unknown,
  legacyTypes?: unknown,
): Record<SuperParamKey, boolean> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out = {} as Record<SuperParamKey, boolean>;
  if (SUPER_PARAM_KEYS.some((key) => typeof r[key] === "boolean")) {
    for (const key of SUPER_PARAM_KEYS) {
      out[key] = bool(r[key], DEFAULT_MAP_SUPERS[key]);
    }
    return out;
  }
  const legacy = (legacyTypes ?? {}) as Record<string, unknown>;
  if (!NEARBY_TYPE_KEYS.some((key) => typeof legacy[key] === "boolean")) {
    return { ...DEFAULT_MAP_SUPERS };
  }
  // An absent slug takes the PRE-1695 default, not `false`: a blob that stored
  // only `{ restaurant: true }` still ran with bar, night_club, cafe and
  // bakery on, and folding it to restaurants-only would silently narrow live
  // Nearby calls on the first read after deploy.
  for (const key of SUPER_PARAM_KEYS) {
    out[key] = GOOGLE_SEARCH_TYPES[key].some((type) =>
      bool(legacy[type], LEGACY_TYPE_DEFAULTS.has(type))
    );
  }
  return out;
}

/** 20, 40 or 60 — snapped to the nearest stop, never a free number. */
export function normalizeGooglePull(raw: unknown): number {
  const n = num(raw, GOOGLE_PULL_DEFAULT, GOOGLE_PULL_STOPS[0], GOOGLE_PULL_STOPS[2]);
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
      supers: normalizeSuperParams(fast.supers, fast.types),
    },
    deep: {
      partnerCount: Math.round(
        num(deep.partnerCount, DEFAULT_NAME_DEEP.partnerCount, 0, NAME_LANE_COUNT_MAX),
      ),
      mesitaCount: Math.round(
        num(deep.mesitaCount, DEFAULT_NAME_DEEP.mesitaCount, 0, NAME_LANE_COUNT_MAX),
      ),
      autoCount: Math.round(
        num(deep.autoCount, DEFAULT_NAME_DEEP.autoCount, 0, NAME_LANE_COUNT_MAX),
      ),
      googleCount: Math.round(
        num(deep.googleCount, DEFAULT_NAME_DEEP.googleCount, 0, NAME_LANE_COUNT_MAX),
      ),
      count: Math.round(
        num(deep.count, DEFAULT_NAME_DEEP.count, 0, NAME_LANE_COUNT_MAX),
      ),
      supers: normalizeSuperParams(deep.supers, deep.types),
    },
  };
}

function normalizeSavedAt(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export function normalizeSwipeConfig(raw: unknown): SwipeConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const biasRaw = (r.partnerBias ?? {}) as Record<string, unknown>;
  const partnerBias = {} as SwipePartnerBias;
  for (const key of SWIPE_PARTNER_LEVELS) {
    partnerBias[key] = Math.round(
      num(
        biasRaw[key],
        DEFAULT_SWIPE.partnerBias[key],
        SWIPE_PARTNER_BIAS_MIN,
        SWIPE_PARTNER_BIAS_MAX,
      ) * 100,
    ) / 100;
  }
  return {
    radiusKm: Math.round(
      num(r.radiusKm, DEFAULT_SWIPE.radiusKm, SWIPE_RADIUS_KM_MIN, SWIPE_RADIUS_KM_MAX) * 10,
    ) / 10,
    closingBufferMin: Math.round(
      num(
        r.closingBufferMin,
        DEFAULT_SWIPE.closingBufferMin,
        SWIPE_CLOSING_BUFFER_MIN,
        SWIPE_CLOSING_BUFFER_MAX,
      ),
    ),
    weightProximity: Math.round(
      num(r.weightProximity, DEFAULT_SWIPE.weightProximity, 0, 1) * 100,
    ) / 100,
    starsExponent: Math.round(
      num(
        r.starsExponent,
        DEFAULT_SWIPE.starsExponent,
        SWIPE_STARS_EXPONENT_MIN,
        SWIPE_STARS_EXPONENT_MAX,
      ) * 100,
    ) / 100,
    logDivisor: Math.round(
      num(r.logDivisor, DEFAULT_SWIPE.logDivisor, SWIPE_LOG_DIVISOR_MIN, SWIPE_LOG_DIVISOR_MAX) *
        100,
    ) / 100,
    partnerBias,
    randomnessMax: Math.round(
      num(
        r.randomnessMax,
        DEFAULT_SWIPE.randomnessMax,
        SWIPE_RANDOMNESS_MAX_MIN,
        SWIPE_RANDOMNESS_MAX_MAX,
      ) * 100,
    ) / 100,
    categoryFilter: bool(r.categoryFilter, DEFAULT_SWIPE.categoryFilter),
    minReviews: Math.round(num(r.minReviews, DEFAULT_SWIPE.minReviews, 0, 100_000)),
    savedAt: normalizeSavedAt(r.savedAt),
  };
}

export function normalizeMapConfig(raw: unknown): MapConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const supers = normalizeSuperParams(r.supers, r.types);
  const reload = snapMapReloadPair(r.reloadMinKm, r.reloadMinSec);
  return {
    minRating: Math.round(
      num(r.minRating, DEFAULT_MAP.minRating, 0, MIN_RATING_MAX) * 10,
    ) / 10,
    minReviews: Math.round(num(r.minReviews, DEFAULT_MAP.minReviews, 0, 100_000)),
    minPopularity: Math.round(
      num(r.minPopularity, DEFAULT_MAP.minPopularity, 0, MAP_MIN_POPULARITY_MAX) * 100,
    ) / 100,
    reloadMinKm: reload.km,
    reloadMinSec: reload.sec,
    googleFill: bool(r.googleFill, DEFAULT_MAP.googleFill),
    supers,
    googlePull: normalizeGooglePull(r.googlePull),
    pinCount: normalizeGooglePull(r.pinCount),
  };
}

/**
 * Tolerant read: any missing or invalid key falls back to its default, and the
 * weights map is rebuilt from SIGNAL_KEYS so the stored blob can never disagree
 * with the code about which signals exist.
 *
 * Exponents are rounded to two decimals. The admin field steps in 0.05 and a
 * float landing at 1.7000000000000002 would make the page permanently `dirty`
 * against its own saved value — the Save button would never settle.
 */
/** Old blobs stored Summary as `semantic`. Fold before SIGNAL_KEYS rebuild. */
export function foldLegacySignalBag(raw: Record<string, unknown>): Record<string, unknown> {
  const next = { ...raw };
  if (next.summary == null && next.semantic != null) next.summary = next.semantic;
  return next;
}

export function normalizeDiscoveryConfig(raw: unknown): DiscoveryConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const rawWeights = foldLegacySignalBag((r.weights ?? {}) as Record<string, unknown>);
  const rawSlotting = (r.slotting ?? {}) as Record<string, unknown>;

  const weights = {} as Record<SignalKey, number>;
  for (const key of SIGNAL_KEYS) {
    const v = num(
      rawWeights[key],
      DISCOVERY_DEFAULTS.weights[key],
      WEIGHT_MIN,
      weightMaxFor(key),
    );
    weights[key] = Math.round(v * 100) / 100;
  }

  const rawFilters = (r.filters ?? {}) as Record<string, unknown>;
  const rawEngines = (r.engines ?? {}) as Record<string, unknown>;

  const engines = {} as Record<WiredEngineKey, { ranked: boolean }>;
  for (const key of WIRED_ENGINE_KEYS) {
    const e = (rawEngines[key] ?? {}) as Record<string, unknown>;
    engines[key] = { ranked: bool(e.ranked, DISCOVERY_DEFAULTS.engines[key].ranked) };
  }

  const rawParams = foldLegacySignalBag((r.params ?? {}) as Record<string, unknown>);
  const params = {} as SignalParams;
  for (const key of SIGNAL_KEYS) {
    const bag = (rawParams[key] ?? {}) as Record<string, unknown>;
    const bounds = SIGNAL_PARAM_BOUNDS[key];
    const next: SignalParamBag = {};
    for (const field of Object.keys(DEFAULT_SIGNAL_PARAMS[key])) {
      const b = bounds[field] ?? { min: 0, max: 1_000_000, decimals: 2 };
      const fallback = DEFAULT_SIGNAL_PARAMS[key][field];
      const v = num(bag[field], fallback, b.min, b.max);
      const factor = 10 ** b.decimals;
      next[field] = Math.round(v * factor) / factor;
    }
    params[key] = next;
  }

  return {
    weights,
    params,
    slotting: {
      enabled: bool(rawSlotting.enabled, DISCOVERY_DEFAULTS.slotting.enabled),
      everyNth: Math.round(
        num(
          rawSlotting.everyNth,
          DISCOVERY_DEFAULTS.slotting.everyNth,
          SLOT_MIN_EVERY_NTH,
          SLOT_MAX_EVERY_NTH,
        ),
      ),
    },
    filters: {
      requireReady: bool(rawFilters.requireReady, DISCOVERY_DEFAULTS.filters.requireReady),
      // Rounded to one decimal: Google stars are one-decimal values, and a
      // floor of 4.300000000000001 would leave the page permanently dirty.
      minRating: Math.round(
        num(rawFilters.minRating, DISCOVERY_DEFAULTS.filters.minRating, 0, MIN_RATING_MAX) * 10,
      ) / 10,
      minReviews: Math.round(
        num(rawFilters.minReviews, DISCOVERY_DEFAULTS.filters.minReviews, 0, 100_000),
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
    engines,
    general: normalizeGeneralConfig(r.general),
    catalog: normalizeCatalogConfig(r.catalog),
    map: normalizeMapConfig(r.map),
    name: normalizeNameConfig(r.name),
    social: normalizeSocialConfig(r.social),
    chat: {
      prompt: normalizeChatPrompt(
        ((r.chat ?? {}) as Record<string, unknown>).prompt,
      ),
    },
    swipe: normalizeSwipeConfig(r.swipe),
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
