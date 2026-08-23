// Discovery catalog — the operator-facing mirror of the signal library.
//
// The vocabulary lives in code on the Edge Function side
// (`supabase/functions/_shared/discovery-signals.ts` SIGNAL_KEYS) and this file
// mirrors it, the same contract sourcing-config/catalog.ts keeps with
// channels.ts: the console edits NUMBERS, never the list of signals. Adding a
// signal is a code change in both packages — deliberately, because a signal
// nobody wrote has nothing to score.
//
// FOUR BOXES, ONE PAGE (Pato, 2026-08-23: "Signals, Engines, Filters. BUT NOT
// SUBPAGES. JUST ONE PAGE FOR ALL DISCOVERY. PERHAPS DIVIDE INTO BOXES."):
//
//   SIGNALS   the six EARNED signals, each with one exponent. Signals compose
//             as `s^w`, so this table is the whole ranking model an operator
//             owns.
//   SLOTTING  the BOUGHT lane, kept out of the blend on purpose. Money buys a
//             deck POSITION, never a score (Pato, 2026-08-22 — the two-lane
//             question §A left open). Promoting is not a signal and there is
//             no row for it above.
//   FILTERS   what may ENTER the pool. A SIGNAL DEMOTES, A FILTER EXCLUDES —
//             that is the whole reason both boxes exist, and why a knob
//             belongs to exactly one of them.
//   ENGINES   which surfaces read any of it. Only a WIRED engine gets a knob.

export const SIGNAL_KEYS = [
  "proximity",
  "timing",
  "category",
  "popularity",
  "semantic",
  "randomness",
] as const;

export type SignalKey = (typeof SIGNAL_KEYS)[number];

export type DiscoveryConfig = {
  weights: Record<SignalKey, number>;
  slotting: { enabled: boolean; everyNth: number };
  filters: DiscoveryFilters;
  engines: Record<WiredEngineKey, { ranked: boolean }>;
};

export type DiscoveryFilters = {
  requireReady: boolean;
  minRating: number;
  minReviews: number;
  maxDistanceKm: number;
};

/** Mirrors WIRED_ENGINE_KEYS in _shared/discovery-config.ts. */
export const WIRED_ENGINE_KEYS = ["swipe"] as const;
export type WiredEngineKey = (typeof WIRED_ENGINE_KEYS)[number];

/** Mirrors WEIGHT_MIN / WEIGHT_MAX in _shared/discovery-config.ts. */
export const WEIGHT_MIN = 0;
export const WEIGHT_MAX = 4;
export const SLOT_MIN_EVERY_NTH = 2;
export const SLOT_MAX_EVERY_NTH = 50;
export const MIN_RATING_MAX = 5;
export const MAX_DISTANCE_KM_MAX = 200;

/** Mirrors DISCOVERY_DEFAULTS. Used only as the seed on a failed load. */
export const DEFAULT_CONFIG: DiscoveryConfig = {
  weights: {
    proximity: 1,
    timing: 1,
    category: 1,
    popularity: 1,
    semantic: 1,
    randomness: 0.35,
  },
  slotting: { enabled: true, everyNth: 5 },
  filters: { requireReady: true, minRating: 0, minReviews: 0, maxDistanceKm: 0 },
  engines: { swipe: { ranked: true } },
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
  what: string;
  state: "LIVE" | "PARKED" | "UNBUILT";
  wired: WiredEngineKey | null;
}[] = [
  {
    key: "swipe",
    label: "Swipe",
    what: "The Home deck. Photo-first cards, right saves, left skips.",
    state: "LIVE",
    wired: "swipe",
  },
  {
    key: "map",
    label: "Map",
    what: "The Search tab: pins, catalog rail, a deliberately plain searchbar.",
    state: "LIVE",
    wired: null,
  },
  {
    key: "favorites",
    label: "Favorites",
    what: "What the guest saved. No ranking question to answer.",
    state: "LIVE",
    wired: null,
  },
  {
    key: "catalog",
    label: "Catalog",
    what: "The grid. Built and working; the page redirects and the pill opens coming-soon.",
    state: "PARKED",
    wired: null,
  },
  {
    key: "chat",
    label: "Chat",
    what: "The Concierge. Ships dark; Don Memo is its persona.",
    state: "PARKED",
    wired: null,
  },
  {
    key: "social",
    label: "Social",
    what: "A live feed of check-ins, likes, rewards and stories.",
    state: "PARKED",
    wired: null,
  },
  {
    key: "name",
    label: "Name",
    what: "Entity resolution: a string in, the right place out.",
    state: "UNBUILT",
    wired: null,
  },
  {
    key: "web",
    label: "Web",
    what: "Perplexity retrieval for what the catalog lacks. Wired inside Chat already.",
    state: "UNBUILT",
    wired: null,
  },
];

/**
 * One row of the weights table.
 *
 * `reads` is what the signal actually looks at, so an operator can tell WHY a
 * weight is doing nothing — Semantic against an un-embedded catalog is not
 * broken, it is abstaining, and the enrichment queue's semantic `summary`
 * function is what fixes that.
 *
 * `engines` names where the exponent is felt TODAY. Swipe is the only engine
 * wired so far; saying so on the page is the difference between an enforced
 * config and a staged one pretending otherwise.
 */
export const SIGNALS: {
  key: SignalKey;
  label: string;
  blurb: string;
  reads: string;
}[] = [
  {
    key: "proximity",
    label: "Proximity",
    blurb: "How far is it, bent through a log curve — close counts hard, far counts gently.",
    reads: "Place geo × the guest's location. No guest location → abstains.",
  },
  {
    key: "timing",
    label: "Timing",
    blurb: "Is it open, and is this its hour — read in the place's own local time.",
    reads: "Weekly hours + the place's local clock. Closed is demoted, never hidden.",
  },
  {
    key: "category",
    label: "Category",
    blurb: "Does the type answer what the guest asked for.",
    reads: "Category and family keys × the guest's stated categories. Swipe states none.",
  },
  {
    key: "popularity",
    label: "Popularity",
    blurb: "Rating shrunk toward the catalog mean by review volume.",
    reads: "Google rating + review count. A thin 5.0 loses to a thick 4.6.",
  },
  {
    key: "semantic",
    label: "Semantic",
    blurb: "The query against the place's Semantic Summary vector.",
    reads: "places.embedding — written by the enrichment queue's semantic Summary function.",
  },
  {
    key: "randomness",
    label: "Randomness",
    blurb: "Reads nothing about the place. Keeps the deck from freezing.",
    reads: "Nothing. It is the only signal with no index at all.",
  },
];

/** Which engines read these weights today. Swipe is the proof-of-enforcement. */
export const WIRED_ENGINES = ["Swipe"] as const;

function num(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
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
  const w = (r.weights ?? {}) as Record<string, unknown>;
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

  return {
    weights,
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
