import type { SignalKey } from "./catalog";
import { FILTERS_FLOOR_OWNER } from "./source-floor-copy";

// The mode × entity × pool × source spec tables the Matrix renders. Spec,
// not a dispatcher: they live only here. The mode keys, signal masks and
// zero pins below mirror `supabase/functions/_shared/discovery-matrix.ts`,
// which the engines read — change one, change the other. Vercel root is
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
// **Social left the mode list**; its retrieval survives as Mesita Social Catalog Search.
export const DISCOVERY_MODE_KEYS = [
  "word",
  "map",
  "catalog",
  "swipe",
  "chat",
  "favorites",
] as const;

export type DiscoveryModeKey = (typeof DISCOVERY_MODE_KEYS)[number];

// DISPLAY STRINGS ONLY — the KEYS beside them are load-bearing and frozen.
//
// `swipe` and `catalog` are persisted keys in `app_config.discovery_config`,
// entries in WIRED_ENGINE_KEYS and DISCOVERY_MODE_KEYS, and the masks behind
// weightsForMode(). Renaming a key would make loadDiscoveryConfig read
// `undefined` and silently fall back to the in-code defaults, discarding every
// tuned value in the live config — and this file and its EF twin pin each
// OTHER, so nothing would go red. The labels below are the only half that may
// follow the consumer app's vocabulary.
//
// MESITA-1697 renamed the two guest-facing surfaces: Home's Swipe mode became
// Scroll (a vertical feed, same deck) and Catalog's body moved to Home's Feed
// tab. The engines did not move, so this is a relabel and nothing else — the
// same key-vs-label split the consumer app already lives with at Pay
// (`/new-visit`) and Activity (`/inbox`). Feed left Home's rail at
// MESITA-2140 (the rail is Swipe · Scroll · Chat · Favs; /discover/feed 308s
// to Scroll), so `catalog` reads Catalog again.
export const DISCOVERY_MODE_LABELS: Record<DiscoveryModeKey, string> = {
  word: "Word",
  map: "Map",
  catalog: "Catalog",
  swipe: "Swipe",
  chat: "Chat",
  favorites: "Favorites",
};

/**
 * What a mode can put IN FRONT OF THE GUEST. A Place is a place; a Location
 * is a region or a city — name, type, and the coordinates the next step
 * needs (Pato, 2026-09-02). A Social is an event a place hosts, which is a
 * different answer from the place itself and never merges into one list with
 * it (MESITA-1856). Filled square = the mode can answer with that entity.
 *
 * Socials is SPEC-ONLY today: Mesita Social Catalog Search is Soon and no
 * events engine exists behind it, so the row states the shape of the answer,
 * not a lane that runs.
 */
export const DISCOVERY_ENTITIES = [
  { key: "location", label: "Locations" },
  { key: "place", label: "Places" },
  { key: "social", label: "Socials" },
] as const;

export type DiscoveryEntityKey = (typeof DISCOVERY_ENTITIES)[number]["key"];

/**
 * Autocomplete is the ONE source that answers with Locations, and it returns
 * them in the SAME call as the Places — not a second request. So the mode
 * that can hand back a Location is exactly the mode that calls Autocomplete:
 * Word. Text Search returns Places even when the query reads like a city, so
 * Word's Location rows only ever come from its Autocomplete query.
 *
 * Socials follows the same rule one band down: the modes that can answer with
 * an event are exactly the modes that call Mesita Social Catalog Search —
 * Catalog rails them, Chat is asked about them.
 */
const DISCOVERY_MODE_ENTITIES: Record<
  DiscoveryModeKey,
  readonly DiscoveryEntityKey[]
> = {
  word: ["location", "place"],
  map: ["place"],
  catalog: ["place"],
  swipe: ["place"],
  chat: [],
  favorites: ["place"],
};

/**
 * THE GUEST'S TWO SCOPES, in the code's own words: `nearby-places.ts` has
 * `PlacesScope = "google" | "selected"` (MESITA-2298), and this band IS that
 * type. Internally the data is still three nested sets (Google Places ⊃
 * Mesita Places ⊃ Mesita Enriched Places), but the middle ring is not a scope
 * anyone picks: Mesita Selected is `enriched_at` set AND `content_state =
 * 'ready'`, and a Created row (a profile that exists, not enriched) rides
 * inside Google Places as a painted hit — the gray pin, never the red one.
 * The word Enriched is the console's, never the guest's.
 */
export const DISCOVERY_POOLS = [
  { key: "google", label: "Google Places" },
  { key: "selected", label: "Mesita Selected" },
] as const;

export type DiscoveryPoolKey = (typeof DISCOVERY_POOLS)[number]["key"];

/**
 * Filled square = the mode serves that scope. Hollow = it does not.
 *
 *   Map        both — the one mode whose GUEST picks the scope. One shared
 *              engine (`_shared/nearby-selection.ts`): Google Places is one
 *              Nearby Search (New) call inside the operator's radius, a
 *              Mesita row winning its own Google id; Mesita Selected is the
 *              enriched, ready rows inside the same radius (`admitsScopeRow`).
 *   Catalog    both — the Feed is rail 1 Google Places, rail 2 Mesita
 *              Selected, then one rail per family from the Selected list.
 *              Google appears only in rail 1 (MESITA-2298 §7).
 *   Swipe      Selected only: Scroll hardcodes `requireReady`, and
 *              requireReady IS the Selected gate — discovery-filters turns it
 *              into `enriched_at IS NOT NULL` AND `content_state = 'ready'`
 *              (MESITA-2154).
 *   Favorites  Google alone: a bookmark is always a Google-sourced place,
 *              and it is NOT gated on enrichment or on a ready profile —
 *              bookmarks may include unenriched Created places.
 *   Word, Chat no scope gate at all; they answer from whatever came back.
 */
const DISCOVERY_MODE_POOLS: Record<
  DiscoveryModeKey,
  readonly DiscoveryPoolKey[]
> = {
  word: [],
  map: ["google", "selected"],
  catalog: ["google", "selected"],
  swipe: ["selected"],
  chat: [],
  favorites: ["google"],
};

/**
 * The seven Sources — Docs > Discovery section 8.2. Signals are not a Source.
 *
 * Pato, 2026-10-13: Browse and Flexible are gone. The catalog is one search
 * per family — Mesita Places Catalog Search, Mesita Social Catalog Search.
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
  FILTERS_FLOOR_OWNER,
  "Mesita Places Catalog Search",
  "Mesita Social Catalog Search",
] as const;

/** Social Catalog has no engine, so no mode calls it. */
export const DISCOVERY_SOURCES_NO_CALLER = ["Mesita Social Catalog Search"] as const;

/**
 * Locked mode → sources. Chips are read-only until dispatch reads a
 * persistable set.
 *
 * THE THREE MESITA PLACES SOURCES ARE TOLD APART BY WHAT DRAWS THE CANDIDATE
 * SET, never by what ranks it:
 *
 *   Name      a string, matched on `places.name_embedding`   → Word
 *   Nearby    a centre and the Map radius, closest-N         → Map, Catalog
 *   Catalog   the catalog's lists, no centre                 → Catalog, Scroll
 *
 * THE FEED BUYS GOOGLE TOO (MESITA-2298 §7-8). Its rail 1 is Google Places
 * Nearby Search — the same one call, radius, floor and ranking as the Map's
 * Google scope. Its Mesita Selected and family rails read the Mesita Nearby
 * pool inside the Map radius when the guest shares a location, and the whole
 * catalog otherwise. Scroll still reads the catalog alone.
 *
 * Browse and Flexible are not sources. Catalog is the one door that used to
 * be split across those two.
 *
 * SOCIAL CATALOG OUTLIVED THE SOCIAL MODE. It answers with events a place
 * hosts, not with places. Catalog rails them; Chat is asked about them.
 * The box stays Soon: there is no events engine.
 */
export const DISCOVERY_MODE_SOURCES = {
  word: [
    "Google Places Autocomplete Search",
    "Google Places Text Search",
    "Mesita Places Name Search",
  ],
  map: ["Google Places Nearby Search", FILTERS_FLOOR_OWNER],
  catalog: [
    "Google Places Nearby Search",
    FILTERS_FLOOR_OWNER,
    "Mesita Places Catalog Search",
  ],
  swipe: ["Mesita Places Catalog Search"],
  chat: [],
  favorites: [],
} as const;

/** Filled circle = the mode may call that signal. Section 8.3 order. */
const DISCOVERY_MODE_SIGNALS: Record<
  DiscoveryModeKey,
  readonly SignalKey[]
> = {
  word: ["name"],
  map: ["category", "proximity", "timing", "enriched", "popularity"],
  catalog: [
    "category",
    "proximity",
    "timing",
    "enriched",
    "popularity",
    "randomness",
  ],
  swipe: [
    "category",
    "proximity",
    "timing",
    "enriched",
    "popularity",
    "randomness",
  ],
  chat: [
    "name",
    "category",
    "proximity",
    "timing",
    "enriched",
    "popularity",
  ],
  favorites: [],
};

/**
 * Present on the mode with weight 0 — off, not missing. The cell renders the
 * labelled em-dash and stores nothing, because on this mode the exponent
 * provably cannot reorder the result.
 *
 * Map / Randomness  a pin field. A shuffled pin is a moved pin.
 */
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
