// Discovery config — the operator's half of the ranking model (Docs ›
// Discovery §A, MESITA-1196).
//
// Keys: weights · weightsByMode · params · filters · engines · general · catalog · map · name · chat · swipe.
// Admin: Modes (Word, Map and Scroll live, each with its own weight column) ·
// Sources (Google types, three Google boxes, Places Lineup, Socials Soon).
// `params` rides with `weights` — same Lineup table, different numbers.
//
//   weights    one exponent per earned signal (`w` in `s^w`). Word's vector,
//              and the fallback under every mode that has no column.
//   weightsByMode  the same vector PER WIRED MODE (MESITA-1859). Map and
//              Scroll are the two that rank, so they are the two columns.
//   params     shape numbers. The console edits maxKm and closedFloor;
//              the rest stay on the blob as the function's defaults.
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
  SIGNAL_KEYS,
  type SignalKey,
  type SignalParamBag,
  TIMING_CLOSED_FLOOR,
  TIMING_OPEN_SHARE,
} from "./discovery-signals.ts";
import {
  WEIGHTED_MODE_KEYS,
  type WeightedModeKey,
} from "./discovery-matrix.ts";
import { bool, num } from "./config-coerce.ts";

export type SignalParams = Record<SignalKey, SignalParamBag>;

/**
 * Catalog Search exponents. One profile for every rail.
 * Family picks the rail, so it is not in this vector. Enriched scores
 * (MESITA-2292): it leads every rail without keeping a Created place out.
 * Timing is out.
 *
 * STORED KEYS vs SCORED KEYS. `catalogScore` multiplies only
 * `CATALOG_LIVE_RANK_KEYS`. Name, Description, and Selected stay on the blob
 * so a save does not drop a stored value, and they are not applied: there is
 * no name query, no description vector, and no per-place Selected value.
 */
export const CATALOG_RANK_KEYS = [
  "name",
  "description",
  "proximity",
  "enriched",
  "popularity",
  "selected",
  "randomness",
] as const;
export type CatalogRankKey = (typeof CATALOG_RANK_KEYS)[number];

/** The signals `catalogScore` actually raises. A zero drops that signal. */
export const CATALOG_LIVE_RANK_KEYS = [
  "proximity",
  "enriched",
  "popularity",
  "randomness",
] as const satisfies readonly CatalogRankKey[];
export type CatalogLiveRankKey = (typeof CATALOG_LIVE_RANK_KEYS)[number];

export const CATALOG_ALL_ZERO_ERROR =
  "At least one Catalog signal must have a weight above zero.";

/**
 * Enriched ships at 2 beside Proximity 1 and Popularity 1: a relative
 * exponent of 0.5, so a Created place scores 0.15^0.5 ≈ 0.39 of an
 * enriched twin. It leads; it does not filter.
 */
export const DEFAULT_CATALOG_RANKING: Record<CatalogRankKey, number> = {
  name: 0,
  description: 1,
  proximity: 1,
  enriched: 2,
  popularity: 1,
  selected: 1,
  randomness: 0,
};

export type CatalogConfig = {
  /** Atlas category rails that currently have inventory. */
  seedCount: number;
  /** Vibe-query rails, sampled from the code-defined bank (not Atlas slugs). */
  generatedCount: number;
  placesPerRail: number;
  /** Seed category must have at least this many listed places. */
  minSeedPlaces: number;
  /** Shared Catalog Search profile. Every guest family list reads this one vector. */
  ranking: Record<CatalogRankKey, number>;
};

/**
 * Relative exponents for the signals Catalog actually scores.
 * A proportional change of every nonzero weight returns the same vector,
 * so it cannot reorder. Zero stays zero and is left out of the sum.
 */
export function catalogRelativeExponents(
  ranking: Record<CatalogRankKey, number>,
): Record<CatalogLiveRankKey, number> {
  const out = {} as Record<CatalogLiveRankKey, number>;
  let sum = 0;
  for (const key of CATALOG_LIVE_RANK_KEYS) {
    const w = ranking[key];
    if (typeof w === "number" && Number.isFinite(w) && w > 0) sum += w;
  }
  for (const key of CATALOG_LIVE_RANK_KEYS) {
    const w = ranking[key];
    const on = typeof w === "number" && Number.isFinite(w) && w > 0;
    out[key] = sum > 0 && on ? w / sum : 0;
  }
  return out;
}

export function catalogLiveWeightsAllZero(
  ranking: Record<CatalogRankKey, number>,
): boolean {
  return CATALOG_LIVE_RANK_KEYS.every((key) => !(ranking[key] > 0));
}

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
 * Map pool policy. Closest N of the selected Places set, then paint.
 * THREE NESTED SETS (MESITA-2158):
 *   Google Places ⊃ Mesita Places ⊃ Mesita Enriched Places
 * Enrichment gates only the inner ring. N is `pinCount`, an OPERATOR number since
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

/**
 * Scroll knobs. Reviews cut the pool; radius and closing buffer draw the lead
 * band (open and inside the radius) without cutting anything — the rest is
 * backfilled behind it (MESITA-2047). Ranking is Places Lineup under the
 * Scroll mask (`weightsByMode.swipe`), inside each band.
 *
 * THE FIVE 2026-08-26 RANKING KNOBS ARE GONE (MESITA-1859). weightProximity,
 * starsExponent, logDivisor, partnerBias and randomnessMax had carried the
 * retired two-signal SUM, and had sat here unread since the blend replaced it.
 * A dead `weightProximity` beside a live per-mode Proximity exponent reads as
 * a second, competing dial — so they are deleted from the type, the defaults
 * and the normalizer, which drops them from the blob on the next save. The
 * unread `categoryFilter` went the same way.
 */
export type SwipeConfig = {
  radiusKm: number;
  closingBufferMin: number;
  minReviews: number;
  /** ISO time of the last Scroll-slice save. Null until the first Save. */
  savedAt: string | null;
};

export type DiscoveryConfig = {
  /**
   * The global exponent vector. STILL LOAD-BEARING after MESITA-1859: it is
   * Word's only vector (`orderDeepLineup` in consumer-search-lane.ts) and the
   * per-mode fallback that makes a missing mode key harmless. No console edits
   * it directly any more; it is what a wired mode falls back to.
   */
  weights: Record<SignalKey, number>;
  /**
   * Per-mode exponents, one column per wired mode (MESITA-1859). Under `Π s^w`
   * only the ratios WITHIN a mode mean anything, so "proximity matters twice
   * as much on the Map as on Scroll" was previously unsayable — a mode could
   * only switch a signal off.
   *
   * The mask is NOT folded in here: `weightsForMode` applies
   * `modeSignalState` first and this bag second. See discovery-matrix.ts.
   */
  weightsByMode: Record<WeightedModeKey, Record<SignalKey, number>>;
  params: SignalParams;
  filters: DiscoveryFilters;
  engines: Record<WiredEngineKey, { ranked: boolean }>;
  general: GeneralConfig;
  catalog: CatalogConfig;
  map: MapConfig;
  name: NameConfig;
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
 * The 4 above is reasoned from a signal that floors around 0.85. `enriched`
 * floors far below that, so the same exponent means something else entirely:
 *
 *   enriched   floors at ENRICHED_OFF = 0.15 → (1 / 0.15)^w ≈ 6.67^w.
 *
 *                w = 1        6.7x
 *                w = 2       44x         the ceiling carried here
 *                w = 4    1,975x         the uniform WEIGHT_MAX
 *
 * WHY 2 (MESITA-1858, the issue asked for this to be decided and recorded).
 * By the WEIGHT_MAX comment's own test — "past that the signal is not
 * important, it is a filter" — enrichment is filter-shaped well before 4: at
 * the uniform ceiling an unenriched place is demoted ~2,000x, which is a
 * catalog filtered to enriched-only wearing a weight's clothing. Raising a
 * ceiling later is a one-number change that cannot break a stored blob;
 * discovering after the fact that the catalog was filtered is not.
 *
 * THE TEST THAT GUARDS THIS MAP pins `enriched` by name and asserts the map
 * is non-empty. A loop over `Object.entries` alone goes vacuous, not red, the
 * day the map is emptied.
 */
export const SIGNAL_WEIGHT_MAX: Partial<Record<SignalKey, number>> = {
  enriched: 2,
};

/** The ceiling that actually applies to one signal's exponent. */
export function weightMaxFor(key: SignalKey): number {
  return SIGNAL_WEIGHT_MAX[key] ?? WEIGHT_MAX;
}

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
  googlePull: GOOGLE_PULL_DEFAULT,
  pinCount: GOOGLE_PULL_DEFAULT,
};

export const DEFAULT_CATALOG: CatalogConfig = {
  seedCount: 8,
  generatedCount: 8,
  placesPerRail: 8,
  minSeedPlaces: 2,
  ranking: { ...DEFAULT_CATALOG_RANKING },
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

/** Closing buffer 30 min — discussed, not settled; operator-editable. */
export const DEFAULT_SWIPE: SwipeConfig = {
  radiusKm: 5,
  closingBufferMin: 30,
  minReviews: 1,
  savedAt: null,
};

/**
 * Default shape numbers. These are the same constants the signal functions
 * fall back to, so a blob with no `params` scores identically to yesterday.
 */
export const DEFAULT_SIGNAL_PARAMS: SignalParams = {
  proximity: {
    maxKm: PROXIMITY_MAX_KM,
    kneeKm: PROXIMITY_KNEE_KM,
    missingGeo: 0.35,
  },
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
  category: {
    exact: CATEGORY_EXACT,
    family: CATEGORY_FAMILY,
    miss: CATEGORY_MISS,
  },
  popularity: {
    priorRating: POPULARITY_PRIOR_RATING,
    confidence: POPULARITY_CONFIDENCE,
    floorRating: POPULARITY_FLOOR_RATING,
  },
  // Zero params since MESITA-2144. `unembedded` was never a console knob and
  // the live blob only ever stored NAME_UNEMBEDDED itself, which `name`
  // falls back to on its own (discovery-signals.ts).
  name: {},
  // Zero params, exactly as `mesita_level` had — the off-value lives as a
  // file-level constant in discovery-signals.ts. Promoting a constant to a
  // console dial later is additive; taking a dial back is not.
  enriched: {},
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
  name: {},
  enriched: {},
  randomness: {},
};

/**
 * Defaults: every earned signal at 1 — its own number, unmodified — except
 * Randomness, which ships at 0.35 so it softens into a tiebreak instead of
 * shuffling the deck. Starting flat is the honest position: nothing has been
 * measured yet, and a fabricated weighting would look like a finding.
 */
const DEFAULT_WEIGHTS: Record<SignalKey, number> = {
  proximity: 1,
  timing: 1,
  category: 1,
  popularity: 1,
  name: 1,
  enriched: 1,
  randomness: 0.35,
};

/**
 * Day zero is byte-identical to the global vector, per wired mode — so the
 * first deploy of MESITA-1859 changes no deck anywhere. The point of the split
 * is that an operator can now MOVE one column without moving the other, not
 * that the two start apart.
 */
export const DEFAULT_WEIGHTS_BY_MODE: Record<
  WeightedModeKey,
  Record<SignalKey, number>
> = Object.fromEntries(
  WEIGHTED_MODE_KEYS.map((mode) => [mode, { ...DEFAULT_WEIGHTS }]),
) as Record<WeightedModeKey, Record<SignalKey, number>>;

export const DISCOVERY_DEFAULTS: DiscoveryConfig = {
  weights: DEFAULT_WEIGHTS,
  weightsByMode: DEFAULT_WEIGHTS_BY_MODE,
  params: DEFAULT_SIGNAL_PARAMS,
  /**
   * `requireReady` (the Enriched gate) ships ON because it is already the
   * shipped behaviour — MESITA-1228 hardcoded it into Map and Swipe, and the
   * product promise is that Swipe, Catalog and the Enriched ring hold only
   * Enriched places (MESITA-2154 made the predicate match the promise).
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
  chat: { prompt: "" },
  swipe: DEFAULT_SWIPE,
};

function normalizeCatalogRanking(raw: unknown): Record<CatalogRankKey, number> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out = {} as Record<CatalogRankKey, number>;
  for (const key of CATALOG_RANK_KEYS) {
    const v = num(r[key], DEFAULT_CATALOG_RANKING[key], WEIGHT_MIN, WEIGHT_MAX);
    out[key] = Math.round(v * 100) / 100;
  }
  return out;
}

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
    ranking: normalizeCatalogRanking(r.ranking),
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

/** 20, 40 or 60 — snapped to the nearest stop, never a free number. */
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
  };
}

function normalizeSavedAt(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export function normalizeSwipeConfig(raw: unknown): SwipeConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    radiusKm: Math.round(
      num(
        r.radiusKm,
        DEFAULT_SWIPE.radiusKm,
        SWIPE_RADIUS_KM_MIN,
        SWIPE_RADIUS_KM_MAX,
      ) * 10,
    ) / 10,
    closingBufferMin: Math.round(
      num(
        r.closingBufferMin,
        DEFAULT_SWIPE.closingBufferMin,
        SWIPE_CLOSING_BUFFER_MIN,
        SWIPE_CLOSING_BUFFER_MAX,
      ),
    ),
    minReviews: Math.round(
      num(r.minReviews, DEFAULT_SWIPE.minReviews, 0, 100_000),
    ),
    savedAt: normalizeSavedAt(r.savedAt),
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
    googlePull: normalizeGooglePull(r.googlePull),
    pinCount: normalizeGooglePull(r.pinCount),
  };
}

/**
 * Retired signal keys an old blob may still carry, and what each one now
 * means.
 *
 *   mesita_level  → enriched   (MESITA-1858)
 *
 * An operator who turned Mesita Level up meant "where the place sits with us
 * matters more", and `enriched` is the one signal left that reads that, so
 * their number lands there rather than falling back to the default 1. An
 * explicitly-set new key always wins over the alias.
 */
export const LEGACY_SIGNAL_ALIASES: Record<string, readonly SignalKey[]> = {
  mesita_level: ["enriched"],
};

const warnedLegacyKeys = new Set<string>();

/** Test seam: the structured warn below fires once per key per process. */
export function resetLegacySignalWarnings(): void {
  warnedLegacyKeys.clear();
}

/**
 * Fold retired signal keys onto their replacements before the SIGNAL_KEYS
 * pass, and SAY SO. Nothing logged this before MESITA-1858, which is the
 * difference between "we changed the blob" and "the operator's numbers
 * vanished and nobody knows when".
 *
 * WEIGHTS ONLY (MESITA-2144). It used to fold `params` too, but `enriched`
 * has no params, so the only thing that fold could ever copy was the
 * retired `mesita_level` bag's `{}` — onto a bag rebuilt empty regardless.
 */
export function foldLegacySignalBag(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...raw };
  for (const [legacy, targets] of Object.entries(LEGACY_SIGNAL_ALIASES)) {
    const value = next[legacy];
    if (value == null) continue;
    const foldedTo: SignalKey[] = [];
    for (const target of targets) {
      if (next[target] == null) {
        next[target] = value;
        foldedTo.push(target);
      }
    }
    // Once per key per process: a ranking EF normalizes on EVERY request, and
    // a line per request would bury the one that matters.
    if (!warnedLegacyKeys.has(legacy)) {
      warnedLegacyKeys.add(legacy);
      console.warn("[discovery-config] legacy signal key", {
        key: legacy,
        value,
        foldedTo,
        // The stored blob keeps the legacy key (the weights map is additive)
        // — this says it was READ, not that it was dropped.
        preserved: true,
      });
    }
  }
  return next;
}

/**
 * Tolerant read: any missing or invalid key falls back to its default, and
 * every key in SIGNAL_KEYS is written.
 *
 * THE WEIGHTS MAP IS ADDITIVE (MESITA-1858). It used to be rebuilt from
 * SIGNAL_KEYS alone, which dropped anything else. That is fine when both
 * halves of the system agree on the key list and catastrophic while they do
 * not: web-admin auto-deploys on merge and Edge Functions deploy by hand, so
 * between the two an operator saving ANY unrelated section (the Chat prompt)
 * would evict a key the still-old EF reads, and it would read a
 * deliberately-set number back as its default with nothing in any log.
 * Preserving unknown weight keys costs one loop and closes the window. An
 * unknown key binds to no signal — `blend` iterates SIGNAL_KEYS — so what it
 * keeps is inert storage, never a live weight.
 *
 * Exponents are rounded to two decimals. The admin field steps in 0.05 and a
 * float landing at 1.7000000000000002 would make the page permanently `dirty`
 * against its own saved value — the Save button would never settle.
 */

export function normalizeDiscoveryConfig(raw: unknown): DiscoveryConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const rawWeights = foldLegacySignalBag(
    (r.weights ?? {}) as Record<string, unknown>,
  );

  const weights: Record<string, number> = {};
  // Unknown keys first, so a known key always overwrites a stale one.
  for (const [key, raw] of Object.entries(rawWeights)) {
    if ((SIGNAL_KEYS as readonly string[]).includes(key)) continue;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n)) continue;
    weights[key] =
      Math.round(Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, n)) * 100) / 100;
  }
  for (const key of SIGNAL_KEYS) {
    const v = num(
      rawWeights[key],
      DISCOVERY_DEFAULTS.weights[key],
      WEIGHT_MIN,
      weightMaxFor(key),
    );
    weights[key] = Math.round(v * 100) / 100;
  }

  // Per-mode exponents (MESITA-1859). REBUILT KEY BY KEY, like every other
  // branch here — which is exactly why it has to exist at all: a key this loop
  // forgets is silently dropped on the next unrelated Save, and nothing goes
  // red.
  //
  // A MISSING COLUMN FALLS BACK TO THIS BLOB'S OWN VECTOR, never to the
  // in-code defaults. The difference is the whole migration: the live config
  // has hand-tuned global exponents, and seeding a column from
  // DISCOVERY_DEFAULTS would quietly revert every one of them on the first
  // read after this deploys. Falling back to `weights` makes a pre-1859 blob
  // score byte-identically to yesterday.
  const rawByMode = (r.weightsByMode ?? {}) as Record<string, unknown>;
  const weightsByMode = {} as Record<
    WeightedModeKey,
    Record<SignalKey, number>
  >;
  for (const mode of WEIGHTED_MODE_KEYS) {
    // No legacy fold here: this bag was born at MESITA-1859, after the
    // `mesita_level` split, so it can never carry the retired key.
    const bag = (rawByMode[mode] ?? {}) as Record<string, unknown>;
    const col = {} as Record<SignalKey, number>;
    for (const key of SIGNAL_KEYS) {
      const v = num(bag[key], weights[key], WEIGHT_MIN, weightMaxFor(key));
      col[key] = Math.round(v * 100) / 100;
    }
    weightsByMode[mode] = col;
  }

  const rawFilters = (r.filters ?? {}) as Record<string, unknown>;
  const rawEngines = (r.engines ?? {}) as Record<string, unknown>;

  const engines = {} as Record<WiredEngineKey, { ranked: boolean }>;
  for (const key of WIRED_ENGINE_KEYS) {
    const e = (rawEngines[key] ?? {}) as Record<string, unknown>;
    engines[key] = {
      ranked: bool(e.ranked, DISCOVERY_DEFAULTS.engines[key].ranked),
    };
  }

  // No legacy fold here (see foldLegacySignalBag): a stored `params` key
  // outside SIGNAL_KEYS, `mesita_level` included, is simply not rebuilt.
  const rawParams = (r.params ?? {}) as Record<string, unknown>;
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
    weights: weights as Record<SignalKey, number>,
    weightsByMode,
    params,
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
    engines,
    general: normalizeGeneralConfig(r.general),
    catalog: normalizeCatalogConfig(r.catalog),
    map: normalizeMapConfig(r.map),
    name: normalizeNameConfig(r.name),
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
