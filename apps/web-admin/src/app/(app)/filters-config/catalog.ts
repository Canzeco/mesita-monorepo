// Discovery catalog — the operator-facing mirror of the signal library.
//
// The vocabulary lives in code on the Edge Function side
// (`supabase/functions/_shared/discovery-signals.ts` SIGNAL_KEYS) and this file
// mirrors it: the console edits NUMBERS, never the list of signals. Adding a
// signal is a code change in both packages — deliberately, because a signal
// nobody wrote has nothing to score.
//
// Live HTML: two subpages — DISCOVERY MODES and SEARCH SOURCES. Mode →
// what it can answer with → sources it may call → signals. Index redirects
// to Modes. The locked matrix is on Modes. The second tab says Search, not
// Discovery (Pato, 2026-09-02): all nine Sources are searches, and the
// matrix band already read Search Sources. The route stays /sources.
//
//   MODES     General · Word (Fast) · Word (Deep) · Map · Catalog · Swipe ·
//             Chat · Favorites. Each card shows locked source chips. Word
//             is ONE mode with two passes: Fast is Autocomplete only, Deep
//             concatenates Autocomplete, Text Search, Mesita Places, and
//             Mesita Partners (Name on Mesita `places.name`, never
//             `google_name`). Word never calls Nearby Search. Map loads
//             closest N of the selected Places set (Partners ⊂ Mesita ⊂
//             Google); inner membership paints, it does not add pins. Caps
//             are per scope, not a sum. Chat calls Text Search, Nearby, and
//             the two Flexible sources. Favorites calls no source and gates
//             on no pool — bookmarks may include Mesita Listed Create stubs
//             (not enriched). Google category knobs live on Search
//             Sources, not here. General sits first, under the matrix:
//             the post-Google wipe (Active + a review floor) every mode
//             runs on what a Google Places query returned.
//   ENTITIES  what a mode can answer with: Places always, Locations on Word
//             only. Autocomplete is the one source that returns regions and
//             cities, in the SAME call as the venues.
//   SOURCES   the Search Sources subpage: Google types strip (categoryCount
//             + type batteries, one list written onto Fast / Deep / Map) ·
//             the three Google Places searches · the four Mesita Places
//             searches (Name · Nearby · Browse · Flexible) · the two Mesita
//             Social searches (Browse · Flexible). Mesita Places Name and
//             Nearby are live without knobs of their own — their counts sit
//             on the Word and Map mode boxes — so the four Soon boxes are
//             Browse, Flexible, and both Social ones.
//   SIGNALS   eight earned signals: Name · Summary · Category · Proximity ·
//             Timing · Mesita Level · Popularity · Randomness. Slotting
//             stays a post-blend position pass. Old `semantic` folds to
//             Summary. Partnership and Promotion merged into Mesita Level
//             and Social left the library (MESITA-1408); Social then left
//             the mode list too, and is now two Sources.
//
// Operator filters still live on the blob so a whole-blob Save cannot
// reset them. They have no knobs on this page.

export const SIGNAL_KEYS = [
  "name",
  "summary",
  "category",
  "proximity",
  "timing",
  "mesita_level",
  "popularity",
  "randomness",
] as const;

export type SignalKey = (typeof SIGNAL_KEYS)[number];

export type SignalParamBag = Record<string, number>;
export type SignalParams = Record<SignalKey, SignalParamBag>;

export type NameFastConfig = {
  /** Redundant with count on Fast — one source. Locked together. */
  googleCount: number;
  count: number;
  types: Record<NearbyTypeKey, boolean>;
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
  types: Record<NearbyTypeKey, boolean>;
};

export type NameConfig = {
  fast: NameFastConfig;
  deep: NameDeepConfig;
};

export type SwipePartnerLevel =
  | "none"
  | "partner"
  | "conservative"
  | "aggressive"
  | "dominant";

export type SwipePartnerBias = Record<SwipePartnerLevel, number>;

export type SwipeConfig = {
  radiusKm: number;
  closingBufferMin: number;
  weightProximity: number;
  starsExponent: number;
  logDivisor: number;
  partnerBias: SwipePartnerBias;
  randomnessMax: number;
  categoryFilter: boolean;
  minReviews: number;
  savedAt: string | null;
};

export type GeneralConfig = {
  categoryCount: number;
  /**
   * The post-Google wipe. Active is `business_status === "OPERATIONAL"` on
   * Mesita, Google's `businessStatus` on a Google-only row. Unknown does not
   * clear it. Mirrors `_shared/discovery-general-gate.ts`.
   */
  requireActive: boolean;
  /** Google reviews a place must prove to survive the wipe. 0 = off. */
  minReviews: number;
};

export type DiscoveryConfig = {
  weights: Record<SignalKey, number>;
  params: SignalParams;
  slotting: { enabled: boolean; everyNth: number };
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

export type CatalogConfig = {
  seedCount: number;
  generatedCount: number;
  placesPerRail: number;
  minSeedPlaces: number;
};

export type SocialConfig = {
  seedCount: number;
  generatedCount: number;
  eventsPerRail: number;
  minSeedEvents: number;
  horizonDays: number;
};

const NEARBY_TYPE_KEYS = [
  "restaurant",
  "bar",
  "cafe",
  "night_club",
  "bakery",
] as const;

/** Discovery-wide cap on how many of `NEARBY_TYPE_KEYS` any engine may use. */
const GENERAL_CATEGORY_COUNT_DEFAULT = NEARBY_TYPE_KEYS.length;
export const GENERAL_CATEGORY_COUNT_MAX = NEARBY_TYPE_KEYS.length;
/** Same ceiling as filters.minReviews — one review floor reads like another. */
export const GENERAL_MIN_REVIEWS_MAX = 100_000;
export type NearbyTypeKey = (typeof NEARBY_TYPE_KEYS)[number];

export type MapConfig = {
  minRating: number;
  minReviews: number;
  minPopularity: number;
  /** Camera must move at least this far (km) before Search refetches Nearby. */
  reloadMinKm: number;
  /** Wait at least this long (seconds) after a fetch before Search refetches. */
  reloadMinSec: number;
  googleFill: boolean;
  types: Record<NearbyTypeKey, boolean>;
};

export const NEARBY_TYPE_FIELDS: { key: NearbyTypeKey; label: string }[] = [
  { key: "restaurant", label: "Restaurants" },
  { key: "bar", label: "Bars" },
  { key: "cafe", label: "Cafés" },
  { key: "night_club", label: "Night clubs" },
  { key: "bakery", label: "Bakeries" },
];

export type ParamField = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
};

export type DiscoveryFilters = {
  requireReady: boolean;
  minRating: number;
  minReviews: number;
  maxDistanceKm: number;
};

/** Mirrors WIRED_ENGINE_KEYS in _shared/discovery-config.ts. */
const WIRED_ENGINE_KEYS = ["swipe"] as const;
export type WiredEngineKey = (typeof WIRED_ENGINE_KEYS)[number];

/** Mirrors WEIGHT_MIN / WEIGHT_MAX in _shared/discovery-config.ts. */
export const WEIGHT_MIN = 0;
export const WEIGHT_MAX = 4;
const SLOT_MIN_EVERY_NTH = 2;
const SLOT_MAX_EVERY_NTH = 50;
const MIN_RATING_MAX = 5;
const MAX_DISTANCE_KM_MAX = 200;
const CATALOG_COUNT_MAX = 20;
const CATALOG_PLACES_PER_RAIL_MIN = 4;
const CATALOG_PLACES_PER_RAIL_MAX = 20;
const CATALOG_MIN_SEED_PLACES_MAX = 20;
const SOCIAL_COUNT_MAX = 20;
const SOCIAL_EVENTS_PER_RAIL_MIN = 4;
const SOCIAL_EVENTS_PER_RAIL_MAX = 20;
const SOCIAL_MIN_SEED_EVENTS_MAX = 20;
const SOCIAL_HORIZON_DAYS_MIN = 1;
const SOCIAL_HORIZON_DAYS_MAX = 90;
const MAP_MIN_POPULARITY_MAX = 1;
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
/** Map Places-set caps. Partners/Mesita max 60; Google Nearby max 20. */
export const NAME_LANE_COUNT_MAX = 20;
const NAME_FAST_COUNT_DEFAULT = 5;
const NAME_PARTNER_COUNT_DEFAULT = 3;
const NAME_MESITA_COUNT_DEFAULT = 3;
const NAME_GOOGLE_COUNT_DEFAULT = 3;
const NAME_DEEP_COUNT_DEFAULT = 9;

const SWIPE_RADIUS_KM_MIN = 1;
const SWIPE_RADIUS_KM_MAX = 50;
const SWIPE_CLOSING_BUFFER_MIN = 0;
const SWIPE_CLOSING_BUFFER_MAX = 180;
const SWIPE_STARS_EXPONENT_MIN = 1;
const SWIPE_STARS_EXPONENT_MAX = 3;
const SWIPE_LOG_DIVISOR_MIN = 1;
const SWIPE_LOG_DIVISOR_MAX = 20;
const SWIPE_PARTNER_BIAS_MIN = 1;
const SWIPE_PARTNER_BIAS_MAX = 2;
const SWIPE_RANDOMNESS_MAX_MIN = 1;
const SWIPE_RANDOMNESS_MAX_MAX = 2;
const SWIPE_PARTNER_LEVELS = [
  "none",
  "partner",
  "conservative",
  "aggressive",
  "dominant",
] as const satisfies readonly SwipePartnerLevel[];
/** Mirrors CHAT_PROMPT_MAX in _shared/discovery-config.ts. */
const CHAT_PROMPT_MAX = 12_000;

/** Candidate Chat connections. Display only — OpenAI is the only live turn. */
export const CHAT_CONNECTIONS = [
  {
    name: "OpenAI chat completions",
    status: "Live",
    note: "Guest thread + Discovery prompt, every turn. models_config.memo.",
  },
  {
    name: "Google Places Text Search (New)",
    status: "Soon",
    note: "Default place lookup. Not Nearby (that is Map). Not Autocomplete (that is the Search bar).",
  },
  {
    name: "Perplexity (web search)",
    status: "Soon",
    note: "Perplexity Search API — ranked web results. Agent is a second connection. Neither is a Source.",
  },
  {
    name: "Internal search EFs",
    status: "Soon",
    note: "Named Mesita lookups (recall / search places) — not a service-role from() from Chat.",
  },
] as const;

/** Indexes Chat may query later. This pass: the two place embeddings only. */
export const CHAT_INDEXES = [
  {
    name: "places.name_embedding",
    status: "Soon",
    note: "Name match. Same vector Deep Search already queries.",
  },
  {
    name: "places.embedding",
    status: "Soon",
    note: "Summary / vibe match. Deliberately not the About field.",
  },
] as const;

/** Later ideas — not this beta. Listed so Discovery owns the brainstorm. */
export const CHAT_LATER = [
  {
    name: "Place Details after a Text Search hit",
    note: "Hours and identity once we have a Place ID — not a first-call API.",
  },
  {
    name: "Cheaper thread ingest",
    note: "Rolling summary, retrieval, or cached prefixes. MESITA-1342.",
  },
  {
    name: "mesita_knowledge",
    note: "House vocabulary (classes, Passport, plans) as a closed tool, not embeddings over Docs.",
  },
  {
    name: "Guest clock + location",
    note: "Daypart and where, without inventing that we looked a place up.",
  },
  {
    name: "Catalog / Swipe as tools",
    note: "Rails and the ranked deck as named APIs, not Chat pretending it is those engines.",
  },
] as const;

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

const DEFAULT_MAP_TYPES: Record<NearbyTypeKey, boolean> = {
  restaurant: true,
  bar: true,
  cafe: true,
  night_club: true,
  bakery: true,
};

export const DEFAULT_MAP: MapConfig = {
  minRating: 0,
  minReviews: 0,
  minPopularity: 0,
  reloadMinKm: 0.5,
  reloadMinSec: 2,
  googleFill: true,
  types: DEFAULT_MAP_TYPES,
};

const DEFAULT_NAME_FAST: NameFastConfig = {
  googleCount: NAME_FAST_COUNT_DEFAULT,
  count: NAME_FAST_COUNT_DEFAULT,
  types: DEFAULT_MAP_TYPES,
};

const DEFAULT_NAME_DEEP: NameDeepConfig = {
  partnerCount: NAME_PARTNER_COUNT_DEFAULT,
  mesitaCount: NAME_MESITA_COUNT_DEFAULT,
  autoCount: NAME_GOOGLE_COUNT_DEFAULT,
  googleCount: NAME_GOOGLE_COUNT_DEFAULT,
  count: NAME_DEEP_COUNT_DEFAULT,
  types: DEFAULT_MAP_TYPES,
};

export const DEFAULT_NAME: NameConfig = {
  fast: DEFAULT_NAME_FAST,
  deep: DEFAULT_NAME_DEEP,
};

export const DEFAULT_GENERAL: GeneralConfig = {
  categoryCount: GENERAL_CATEGORY_COUNT_DEFAULT,
  requireActive: true,
  minReviews: 0,
};

const DEFAULT_SWIPE_PARTNER_BIAS: SwipePartnerBias = {
  none: 1,
  partner: 1.25,
  conservative: 1.5,
  aggressive: 1.75,
  dominant: 2,
};

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

/** Mirrors DISCOVERY_DEFAULTS. Used only as the seed on a failed load. */
const DEFAULT_SIGNAL_PARAMS: SignalParams = {
  proximity: { maxKm: 25, kneeKm: 1, missingGeo: 0.35 },
  timing: {
    openShare: 0.7,
    closedFloor: 0.2,
    dead: 0.25,
    dawn: 0.55,
    breakfast: 0.8,
    midday: 1,
    evening: 1,
    late: 0.5,
  },
  category: { exact: 1, family: 0.55, miss: 0.1 },
  popularity: { priorRating: 4.2, confidence: 60, floorRating: 3 },
  name: { unembedded: 0.4 },
  summary: { unembedded: 0.4 },
  mesita_level: {},
  randomness: {},
};

export const DEFAULT_CONFIG: DiscoveryConfig = {
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
  slotting: { enabled: true, everyNth: 5 },
  filters: { requireReady: true, minRating: 0, minReviews: 0, maxDistanceKm: 0 },
  engines: { swipe: { ranked: true } },
  general: DEFAULT_GENERAL,
  catalog: DEFAULT_CATALOG,
  map: DEFAULT_MAP,
  name: DEFAULT_NAME,
  social: DEFAULT_SOCIAL,
  chat: { prompt: "" },
  swipe: DEFAULT_SWIPE,
};

/**
 * The engine registry — Docs › Discovery §B, mirrored for the console.
 *
 * `wired` is the only thing that decides whether a row gets a control. An
 * engine that does not read the signal library must not offer a toggle over
 * it: the house rule is that a page whose engine is unbuilt shows its state,
 * not knobs.
 */
export const ENGINES: {
  key: string;
  label: string;
  fn: string;
  input: string;
  process: string;
  output: string;
  state: "LIVE" | "PARKED" | "UNBUILT";
  wired: WiredEngineKey | null;
  /** Vendor APIs this function calls when it runs. Empty = none. */
  apis: string[];
}[] = [
  {
    key: "swipe",
    label: "Swipe",
    fn: "swipe()",
    input: "Ready pool + guest geo.",
    process: "Parked. Home is Soon. When the deck runs, Places Lineup ranks under the Swipe mask. Admission stays radius, reviews, open+buffer, and type batteries.",
    output: "Ordered Home deck, when unparked.",
    state: "PARKED",
    wired: "swipe",
    apis: [],
  },
  {
    key: "map",
    label: "Map",
    fn: "map()",
    input: "Ready pool + guest pin / Monterrey.",
    process: "Places scope picks one of TWO nested sets — Mesita Places ⊂ Google Places; Partners are not a set, a partner is a Mesita Place painted yellow. Mesita Places means created AND enriched (honest name: Mesita Enriched Places) — a Created or Requested stub is never a search source, and partners always ride along. Closest N of that set; a smaller membership paints, it does not add a pin. Partners and Mesita never call Nearby. Google is one Nearby Search among enabled categories, nearest N. Max pins = that N, never the sum. N is the guest's How many on the Filters sheet — the console never asks for a count. Listed pins then Lineup, not distance. Google set stays distance. Pins, checked in that order: yellow = Mesita Partner Places (the place PAYS), red = Mesita ENRICHED Places (we wrote a profile), gray = everything else — Google rows AND our own Created/Requested stubs, which have nothing to show. Red is earned by enrichment, never by a row existing. Blue is the guest's current location, never a place. Empty Nearby falls back to the Mesita set. Search auto-refetches after a reload pair (km AND sec). Rail or pin selection does not refetch.",
    output: "Pins and catalog rail.",
    state: "LIVE",
    wired: null,
    apis: ["Google Places Nearby Search"],
  },
  {
    key: "favorites",
    label: "Favorites",
    fn: "favorites()",
    input: "What this guest saved.",
    process: "Parked. Home is Soon. Recency of the save; no ranking. No pool gate — Mesita Listed Create stubs (not enriched) may be saved alongside Google and enriched rows.",
    output: "The saved list, when unparked.",
    state: "PARKED",
    wired: null,
    apis: [],
  },
  {
    key: "catalog",
    label: "Catalog",
    fn: "catalog()",
    input: "Ready pool.",
    process: "Parked. Home is Soon. Rails stay on disk. Admin box is Soon; knobs persist on the blob.",
    output: "Stacked catalog rails, when unparked.",
    state: "PARKED",
    wired: null,
    apis: [],
  },
  {
    key: "chat",
    label: "Chat",
    fn: "chat()",
    input: "The guest's utterance plus the thread the client resends.",
    process: "Parked. Home is Soon. OpenAI chat completions and the Discovery prompt stay on the blob.",
    output: "A conversational reply, when unparked.",
    state: "PARKED",
    wired: null,
    apis: ["OpenAI"],
  },
  {
    key: "social",
    label: "Social",
    fn: "social()",
    input: "Upcoming events at listed places (happenings, not venues).",
    process: "Parked. Home is Soon. Admin box is Soon; knobs persist on the blob; no events engine yet. Will query events, not places.",
    output: "Event rails on Home › Social, when unparked.",
    state: "PARKED",
    wired: null,
    apis: [],
  },
  {
    key: "name",
    label: "Name",
    fn: "name()",
    input: "A string + optional country + guest pin.",
    process: "Fast: Autocomplete only. Deep: four independent query caps, then concat. Autocomplete → Text Search → Mesita Places → Mesita Partners. Overlaps drop; first query keeps the slot. Caps are per query, not nested. Deep never calls Nearby Search. A Google hit that resolves to Mesita stays in its Google query. Places Lineup Name (`places.name`, not `google_name`). Map Filters never cut this list. Lineup Summary and the other Lineup signals are not a Deep input. Google types live on Search Sources.",
    output: "The right place.",
    state: "LIVE",
    wired: null,
    apis: ["Google Places Autocomplete", "Google Places Text Search", "Place Details"],
  },
  {
    key: "web",
    label: "Web",
    fn: "web()",
    input: "A query the catalog cannot answer.",
    process: "Unbuilt. Perplexity retrieval. Already called from Chat.",
    output: "Places the catalog lacks.",
    state: "UNBUILT",
    wired: null,
    apis: ["Perplexity"],
  },
];

/**
 * One row of the weights table.
 *
 * `reads` is what the signal actually looks at, so an operator can tell WHY a
 * weight is doing nothing — Summary against an un-embedded catalog is not
 * broken, it is abstaining, and the enrichment queue's semantic `summary`
 * function is what fixes that.
 *
 * `engines` names where the exponent is felt TODAY. Map, Word, and Swipe
 * read weightsForMode. Catalog and Chat stay pending. Weights on a red
 * matrix cell are 0 for that mode.
 */
const UNIT: ParamField[] = [];
const ZERO_ONE = (key: string, label: string): ParamField => ({
  key,
  label,
  min: 0,
  max: 1,
  step: 0.05,
});

/** Ranges for shape numbers that stay in the blob but are not console knobs. */
const HIDDEN_FIELD: Record<string, Pick<ParamField, "min" | "max" | "step">> = {
  kneeKm: { min: 0.1, max: 25, step: 0.1 },
  missingGeo: { min: 0, max: 1, step: 0.05 },
  openShare: { min: 0, max: 1, step: 0.05 },
  dead: { min: 0, max: 1, step: 0.05 },
  dawn: { min: 0, max: 1, step: 0.05 },
  breakfast: { min: 0, max: 1, step: 0.05 },
  midday: { min: 0, max: 1, step: 0.05 },
  evening: { min: 0, max: 1, step: 0.05 },
  late: { min: 0, max: 1, step: 0.05 },
  exact: { min: 0, max: 1, step: 0.05 },
  family: { min: 0, max: 1, step: 0.05 },
  miss: { min: 0, max: 1, step: 0.05 },
  priorRating: { min: 0, max: 5, step: 0.1 },
  confidence: { min: 1, max: 1000, step: 1 },
  floorRating: { min: 0, max: 4.9, step: 0.1 },
  unembedded: { min: 0, max: 1, step: 0.05 },
};

/**
 * Signal order — Notion Docs > Discovery section 8.3. What the caller ASKED
 * FOR first, then what the world is, then where the place sits with us, then
 * the tie-breaker. Presentation only: the blend is a product, so order cannot
 * change a score.
 */
export const LIBRARY_SIGNALS = [
  { kind: "signal" as const, key: "name" as const },
  { kind: "signal" as const, key: "summary" as const },
  { kind: "signal" as const, key: "category" as const },
  { kind: "signal" as const, key: "proximity" as const },
  { kind: "signal" as const, key: "timing" as const },
  { kind: "signal" as const, key: "mesita_level" as const },
  { kind: "signal" as const, key: "popularity" as const },
  { kind: "signal" as const, key: "randomness" as const },
] as const;

// Twin of `supabase/functions/_shared/discovery-matrix.ts`. Spec mirror,
// not a dispatcher. Change one, change the other. Vercel root is
// apps/web-admin, so this bundle cannot import the EF file.
//
// TWO NOUNS, AND ONLY TWO: a **Mode** is a guest Discovery surface, a
// **Source** is a retrieval mechanism a mode calls. `module` is retired —
// these things do not modularize anything, they fetch, and *modo / módulo*
// differ by two letters in the language the team speaks.
//
// SIX MODES (Docs > Discovery section 8.1). Name (Fast) and Name (Deep) are
// one mode now, **Word**: the searchbar, both its passes, and the only mode
// that can answer with a Location. Word and Map share a screen and are still
// two modes, because they answer with different sets from different sources.
// **Social left the mode list**; its retrieval survives as two Sources.
export const DISCOVERY_MODE_KEYS = [
  "word",
  "map",
  "catalog",
  "swipe",
  "chat",
  "favorites",
] as const;

export type DiscoveryModeKey = (typeof DISCOVERY_MODE_KEYS)[number];

export const DISCOVERY_MODE_LABELS: Record<DiscoveryModeKey, string> = {
  word: "Word",
  map: "Map",
  catalog: "Catalog",
  swipe: "Swipe",
  chat: "Chat",
  favorites: "Favorites",
};

/**
 * What a mode can put IN FRONT OF THE GUEST. A Place is a venue; a Location
 * is a region or a city — name, type, and the coordinates the next step
 * needs (Pato, 2026-09-02). Black square = the mode can answer with that
 * entity.
 */
export const DISCOVERY_ENTITIES = [
  { key: "place", label: "Places" },
  { key: "location", label: "Locations" },
] as const;

export type DiscoveryEntityKey = (typeof DISCOVERY_ENTITIES)[number]["key"];

/**
 * Autocomplete is the ONE source that answers with Locations, and it returns
 * them in the SAME call as the Places — not a second request. So the mode
 * that can hand back a Location is exactly the mode that calls Autocomplete:
 * Word. Text Search returns Places even when the query reads like a city, so
 * Word's Location rows only ever come from its Autocomplete query.
 */
const DISCOVERY_MODE_ENTITIES: Record<
  DiscoveryModeKey,
  readonly DiscoveryEntityKey[]
> = {
  word: ["place", "location"],
  map: ["place"],
  catalog: ["place"],
  swipe: ["place"],
  chat: ["place"],
  favorites: ["place"],
};

export const DISCOVERY_POOLS = [
  { key: "google", label: "Google Places" },
  { key: "listed", label: "Mesita Listed" },
  { key: "enriched", label: "Mesita Enriched" },
] as const;

export type DiscoveryPoolKey = (typeof DISCOVERY_POOLS)[number]["key"];

/** Black square = the mode requires that pool. Grey = not a gate. */
const DISCOVERY_MODE_POOLS: Record<
  DiscoveryModeKey,
  readonly DiscoveryPoolKey[]
> = {
  word: [],
  map: [],
  catalog: ["google", "listed"],
  swipe: ["google", "listed"],
  chat: [],
  favorites: ["google"],
};

/**
 * The nine Sources — Docs > Discovery section 8.2. Signals are not a Source.
 *
 * `Search` survives on the three Google entries because it quotes endpoints
 * Google itself named that way, and on the six Mesita entries because they
 * are the same kind of thing: a call that returns candidates.
 *
 * PERPLEXITY IS NOT A SOURCE. It was on the old seven-module list twice
 * (Search, Agent) and neither is retrieval Mesita performs — Chat has no
 * external retrieval behind it today.
 */
export const DISCOVERY_SOURCES = [
  "Google Places Autocomplete Search",
  "Google Places Text Search",
  "Google Places Nearby Search",
  "Mesita Places Name Search",
  "Mesita Places Nearby Search",
  "Mesita Places Browse Search",
  "Mesita Places Flexible Search",
  "Mesita Social Browse Search",
  "Mesita Social Flexible Search",
] as const;

/**
 * Locked mode → sources. Chips are read-only until dispatch reads a
 * persistable set.
 *
 * THE FOUR MESITA PLACES SOURCES ARE TOLD APART BY WHAT DRAWS THE CANDIDATE
 * SET, never by what ranks it — Lineup ranks all four the same way, under the
 * mode's own signal mask:
 *
 *   Name      a string, matched on `places.name_embedding`   → Word
 *   Nearby    a centre and a radius, closest-N               → Map
 *   Browse    no query at all, the catalog itself            → Catalog
 *   Flexible  an arbitrary set of predicates                 → Swipe, Chat
 *
 * SWIPE IS FLEXIBLE, NOT BROWSE, and the difference is the guest's own filter
 * sheet: Swipe admits on four predicates it was handed, Catalog admits on
 * nothing and rails whatever the catalog holds.
 *
 * THE SOCIAL SOURCES OUTLIVED THE SOCIAL MODE. Social answers with events a
 * place hosts, not with places, and it lost its own surface when the mode
 * list became six — so its two sources hang off the two modes that can carry
 * an event: Catalog rails it, Chat is asked about it. Both stay Soon; there
 * is no events engine.
 */
export const DISCOVERY_MODE_SOURCES = {
  word: [
    "Google Places Autocomplete Search",
    "Google Places Text Search",
    "Mesita Places Name Search",
  ],
  map: ["Google Places Nearby Search", "Mesita Places Nearby Search"],
  catalog: ["Mesita Places Browse Search", "Mesita Social Browse Search"],
  swipe: ["Mesita Places Flexible Search"],
  chat: [
    "Google Places Text Search",
    "Google Places Nearby Search",
    "Mesita Places Flexible Search",
    "Mesita Social Flexible Search",
  ],
  favorites: [],
} as const;

/** Green circle = the mode may call that signal. Section 8.3 order. */
const DISCOVERY_MODE_SIGNALS: Record<
  DiscoveryModeKey,
  readonly SignalKey[]
> = {
  word: ["name"],
  map: ["category", "proximity", "timing", "mesita_level", "popularity"],
  catalog: [
    "category",
    "proximity",
    "timing",
    "mesita_level",
    "popularity",
    "randomness",
  ],
  swipe: [
    "category",
    "proximity",
    "timing",
    "mesita_level",
    "popularity",
    "randomness",
  ],
  chat: [
    "name",
    "summary",
    "category",
    "proximity",
    "timing",
    "mesita_level",
    "popularity",
  ],
  favorites: [],
};

/** Present on the mode with weight 0 — off, not missing. Map Randomness. */
const DISCOVERY_MODE_SIGNAL_ZERO: Partial<
  Record<DiscoveryModeKey, readonly SignalKey[]>
> = {
  map: ["randomness"],
};

export function modeReturnsEntity(
  mode: DiscoveryModeKey,
  entity: DiscoveryEntityKey,
): boolean {
  return DISCOVERY_MODE_ENTITIES[mode].includes(entity);
}

export function modeRequiresPool(
  mode: DiscoveryModeKey,
  pool: DiscoveryPoolKey,
): boolean {
  return DISCOVERY_MODE_POOLS[mode].includes(pool);
}

export function modeCallsSource(mode: DiscoveryModeKey, source: string): boolean {
  return (DISCOVERY_MODE_SOURCES[mode] as readonly string[]).includes(source);
}

export function modeSignalState(
  mode: DiscoveryModeKey,
  signal: SignalKey,
): "on" | "off" | "zero" {
  if (DISCOVERY_MODE_SIGNAL_ZERO[mode]?.includes(signal)) return "zero";
  if (DISCOVERY_MODE_SIGNALS[mode].includes(signal)) return "on";
  return "off";
}

export const SIGNALS: {
  key: SignalKey;
  label: string;
  fn: string;
  input: string;
  process: string;
  output: string;
  fields: ParamField[];
  /** Vendor APIs this function calls at rank time. Empty = none. */
  apis: string[];
}[] = [
  {
    key: "name",
    label: "Name",
    fn: "name()",
    input: "Query × places.name_embedding (Mesita `places.name`, not `google_name`).",
    process: "(cosine + 1) / 2. No name query → abstain.",
    output: "Unembedded place → unembedded, never deleted.",
    apis: [],
    fields: UNIT,
  },
  {
    key: "summary",
    label: "Summary",
    fn: "summary()",
    input: "Query vector × places.embedding (Summary, never Presentation).",
    process: "(cosine + 1) / 2. No query → abstain. Old semantic weight folds here.",
    output: "Unembedded place → unembedded, never deleted.",
    apis: [],
    fields: UNIT,
  },
  {
    key: "proximity",
    label: "Proximity",
    fn: "proximity()",
    input: "Place geo × guest geo. No guest geo → abstains at 1.",
    process: "Haversine km, then 1 − log1p(km / knee) / log1p(max / knee).",
    output: "1 at the guest, 0 past maxKm. Unlocated place → missingGeo.",
    apis: [],
    fields: [{ key: "maxKm", label: "Max km", min: 1, max: 200, step: 0.5 }],
  },
  {
    key: "timing",
    label: "Timing",
    fn: "timing()",
    input: "Weekly hours × the place's local clock.",
    process: "openShare × openOrFloor + (1 − openShare) × daypart(hour).",
    output: "Closed is demoted to closedFloor, never hidden.",
    apis: [],
    fields: [ZERO_ONE("closedFloor", "Closed floor")],
  },
  {
    key: "category",
    label: "Category",
    fn: "category()",
    input: "Place category/family × guest categories. Swipe states none.",
    process: "exact hit, else family hit, else miss. No intent → abstain.",
    output: "One of exact / family / miss.",
    apis: [],
    fields: UNIT,
  },
  {
    key: "popularity",
    label: "Popularity",
    fn: "popularity()",
    input: "Google rating + review count.",
    process: "(v·r + m·prior) / (v + m), then stretch from floorRating to 5.",
    output: "Unrated place gets the prior, never an abstention.",
    apis: [],
    fields: UNIT,
  },
  {
    key: "mesita_level",
    label: "Mesita Level",
    fn: "mesitaLevel()",
    input: "Place plan and the computed promoting boolean. Never strategy, rates, or pause columns.",
    process: "Three rungs, ×5 apart: neither → 0.04, one → 0.2, both → 1. Demotes, never hides.",
    output: "How far up the Mesita spectrum the place sits, from catalog row to actively promoting.",
    apis: [],
    fields: UNIT,
  },
  {
    key: "randomness",
    label: "Randomness",
    fn: "randomness()",
    input: "Nothing about the place. A uniform draw.",
    process: "rng() in [0, 1). The exponent is the only knob.",
    output: "A number that only breaks near-ties when the exponent is soft.",
    apis: [],
    fields: UNIT,
  },
];

/** Engines that expose a ranked-on toggle. Swipe is the only one. */
export const WIRED_ENGINES = ["Swipe"] as const;

function num(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Old blobs stored Summary as `semantic`. Fold before SIGNAL_KEYS rebuild. */
function foldLegacySignalBag(raw: Record<string, unknown>): Record<string, unknown> {
  const next = { ...raw };
  if (next.summary == null && next.semantic != null) next.summary = next.semantic;
  return next;
}

/**
 * Tolerant read of whatever the EF returned, rebuilt against SIGNAL_KEYS.
 *
 * Exponents round to two decimals for the same reason the EF normalizer does:
 * the field steps in 0.05, and a float landing at 1.7000000000000002 would
 * leave the page permanently `dirty` against its own saved value.
 */
export function coerceConfig(raw: unknown): DiscoveryConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const w = foldLegacySignalBag((r.weights ?? {}) as Record<string, unknown>);
  const s = (r.slotting ?? {}) as Record<string, unknown>;

  const weights = {} as Record<SignalKey, number>;
  for (const key of SIGNAL_KEYS) {
    const v = num(w[key], DEFAULT_CONFIG.weights[key], WEIGHT_MIN, WEIGHT_MAX);
    weights[key] = Math.round(v * 100) / 100;
  }

  const f = (r.filters ?? {}) as Record<string, unknown>;
  const e = (r.engines ?? {}) as Record<string, unknown>;

  const engines = {} as Record<WiredEngineKey, { ranked: boolean }>;
  for (const key of WIRED_ENGINE_KEYS) {
    const row = (e[key] ?? {}) as Record<string, unknown>;
    engines[key] = {
      ranked: typeof row.ranked === "boolean" ? row.ranked : DEFAULT_CONFIG.engines[key].ranked,
    };
  }

  const rawParams = foldLegacySignalBag((r.params ?? {}) as Record<string, unknown>);
  const params = {} as SignalParams;
  for (const key of SIGNAL_KEYS) {
    const bag = (rawParams[key] ?? {}) as Record<string, unknown>;
    const next: SignalParamBag = {};
    const spec = SIGNALS.find((s) => s.key === key);
    for (const fieldKey of Object.keys(DEFAULT_SIGNAL_PARAMS[key])) {
      const field = spec?.fields.find((f) => f.key === fieldKey);
      const hidden = HIDDEN_FIELD[fieldKey];
      const fallback = DEFAULT_SIGNAL_PARAMS[key][fieldKey];
      const min = field?.min ?? hidden?.min ?? 0;
      const max = field?.max ?? hidden?.max ?? 1_000_000;
      const step = field?.step ?? hidden?.step ?? 0.01;
      const v = num(bag[fieldKey], fallback, min, max);
      const decimals = step >= 1 ? 0 : step >= 0.5 ? 1 : 2;
      const factor = 10 ** decimals;
      next[fieldKey] = Math.round(v * factor) / factor;
    }
    params[key] = next;
  }

  return {
    weights,
    params,
    slotting: {
      enabled: typeof s.enabled === "boolean" ? s.enabled : DEFAULT_CONFIG.slotting.enabled,
      everyNth: Math.round(
        num(s.everyNth, DEFAULT_CONFIG.slotting.everyNth, SLOT_MIN_EVERY_NTH, SLOT_MAX_EVERY_NTH),
      ),
    },
    filters: {
      requireReady: typeof f.requireReady === "boolean"
        ? f.requireReady
        : DEFAULT_CONFIG.filters.requireReady,
      // One decimal: Google stars are one-decimal values, and a floor landing
      // at 4.300000000000001 would leave the page permanently dirty.
      minRating: Math.round(
        num(f.minRating, DEFAULT_CONFIG.filters.minRating, 0, MIN_RATING_MAX) * 10,
      ) / 10,
      minReviews: Math.round(num(f.minReviews, DEFAULT_CONFIG.filters.minReviews, 0, 100_000)),
      maxDistanceKm: Math.round(
        num(f.maxDistanceKm, DEFAULT_CONFIG.filters.maxDistanceKm, 0, MAX_DISTANCE_KM_MAX),
      ),
    },
    engines,
    general: coerceGeneral(r.general),
    catalog: coerceCatalog(r.catalog),
    map: coerceMap(r.map),
    name: coerceName(r.name),
    social: coerceSocial(r.social),
    chat: {
      prompt: typeof (r.chat as { prompt?: unknown } | undefined)?.prompt === "string"
        ? (r.chat as { prompt: string }).prompt.slice(0, CHAT_PROMPT_MAX)
        : DEFAULT_CONFIG.chat.prompt,
    },
    swipe: coerceSwipe(r.swipe),
  };
}

function coerceSavedAt(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function coerceSwipe(raw: unknown): SwipeConfig {
  const s = (raw ?? {}) as Record<string, unknown>;
  const biasRaw = (s.partnerBias ?? {}) as Record<string, unknown>;
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
      num(s.radiusKm, DEFAULT_SWIPE.radiusKm, SWIPE_RADIUS_KM_MIN, SWIPE_RADIUS_KM_MAX) * 10,
    ) / 10,
    closingBufferMin: Math.round(
      num(
        s.closingBufferMin,
        DEFAULT_SWIPE.closingBufferMin,
        SWIPE_CLOSING_BUFFER_MIN,
        SWIPE_CLOSING_BUFFER_MAX,
      ),
    ),
    weightProximity: Math.round(
      num(s.weightProximity, DEFAULT_SWIPE.weightProximity, 0, 1) * 100,
    ) / 100,
    starsExponent: Math.round(
      num(
        s.starsExponent,
        DEFAULT_SWIPE.starsExponent,
        SWIPE_STARS_EXPONENT_MIN,
        SWIPE_STARS_EXPONENT_MAX,
      ) * 100,
    ) / 100,
    logDivisor: Math.round(
      num(s.logDivisor, DEFAULT_SWIPE.logDivisor, SWIPE_LOG_DIVISOR_MIN, SWIPE_LOG_DIVISOR_MAX) *
        100,
    ) / 100,
    partnerBias,
    randomnessMax: Math.round(
      num(
        s.randomnessMax,
        DEFAULT_SWIPE.randomnessMax,
        SWIPE_RANDOMNESS_MAX_MIN,
        SWIPE_RANDOMNESS_MAX_MAX,
      ) * 100,
    ) / 100,
    categoryFilter: typeof s.categoryFilter === "boolean"
      ? s.categoryFilter
      : DEFAULT_SWIPE.categoryFilter,
    minReviews: Math.round(num(s.minReviews, DEFAULT_SWIPE.minReviews, 0, 100_000)),
    savedAt: coerceSavedAt(s.savedAt),
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

function coerceSocial(raw: unknown): SocialConfig {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    seedCount: Math.round(num(s.seedCount, DEFAULT_SOCIAL.seedCount, 0, SOCIAL_COUNT_MAX)),
    generatedCount: Math.round(
      num(s.generatedCount, DEFAULT_SOCIAL.generatedCount, 0, SOCIAL_COUNT_MAX),
    ),
    eventsPerRail: Math.round(
      num(
        s.eventsPerRail,
        DEFAULT_SOCIAL.eventsPerRail,
        SOCIAL_EVENTS_PER_RAIL_MIN,
        SOCIAL_EVENTS_PER_RAIL_MAX,
      ),
    ),
    minSeedEvents: Math.round(
      num(s.minSeedEvents, DEFAULT_SOCIAL.minSeedEvents, 1, SOCIAL_MIN_SEED_EVENTS_MAX),
    ),
    horizonDays: Math.round(
      num(
        s.horizonDays,
        DEFAULT_SOCIAL.horizonDays,
        SOCIAL_HORIZON_DAYS_MIN,
        SOCIAL_HORIZON_DAYS_MAX,
      ),
    ),
  };
}

function coerceTypeBatteries(raw: unknown): Record<NearbyTypeKey, boolean> {
  const rawTypes = (raw ?? {}) as Record<string, unknown>;
  const types = {} as Record<NearbyTypeKey, boolean>;
  for (const key of NEARBY_TYPE_KEYS) {
    types[key] = typeof rawTypes[key] === "boolean"
      ? rawTypes[key]
      : DEFAULT_MAP_TYPES[key];
  }
  return types;
}

function coerceGeneral(raw: unknown): GeneralConfig {
  const g = (raw ?? {}) as Record<string, unknown>;
  return {
    categoryCount: Math.round(
      num(
        g.categoryCount,
        DEFAULT_GENERAL.categoryCount,
        0,
        GENERAL_CATEGORY_COUNT_MAX,
      ),
    ),
    requireActive:
      typeof g.requireActive === "boolean"
        ? g.requireActive
        : DEFAULT_GENERAL.requireActive,
    minReviews: Math.round(
      num(g.minReviews, DEFAULT_GENERAL.minReviews, 0, GENERAL_MIN_REVIEWS_MAX),
    ),
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
      types: coerceTypeBatteries(fast.types),
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
      types: coerceTypeBatteries(deep.types),
    },
  };
}

function coerceMap(raw: unknown): MapConfig {
  const m = (raw ?? {}) as Record<string, unknown>;
  const types = coerceTypeBatteries(m.types);
  const reload = snapMapReloadPair(m.reloadMinKm, m.reloadMinSec);
  return {
    minRating: Math.round(
      num(m.minRating, DEFAULT_MAP.minRating, 0, MIN_RATING_MAX) * 10,
    ) / 10,
    minReviews: Math.round(num(m.minReviews, DEFAULT_MAP.minReviews, 0, 100_000)),
    minPopularity: Math.round(
      num(m.minPopularity, DEFAULT_MAP.minPopularity, 0, MAP_MIN_POPULARITY_MAX) * 100,
    ) / 100,
    reloadMinKm: reload.km,
    reloadMinSec: reload.sec,
    googleFill: typeof m.googleFill === "boolean" ? m.googleFill : DEFAULT_MAP.googleFill,
    types,
  };
}

/**
 * How an exponent reads in words. The table shows this beside every row,
 * because "1.6" means nothing on its own and the whole model is the ratio
 * between rows.
 */
export function weightMeaning(w: number): string {
  if (w <= 0) return "Off — drops out of the blend";
  if (w < 0.75) return "Soft — only breaks near-ties";
  if (w < 1.25) return "Normal — the signal's own number";
  if (w < 2.5) return "Sharp — near-misses fall away";
  return "Harsh — only near-perfect survives";
}
