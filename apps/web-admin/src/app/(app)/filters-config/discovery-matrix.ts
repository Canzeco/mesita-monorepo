import type { SignalKey } from "./catalog";

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
// (`/new-visit`) and Activity (`/inbox`).
export const DISCOVERY_MODE_LABELS: Record<DiscoveryModeKey, string> = {
  word: "Word",
  map: "Map",
  catalog: "Feed",
  swipe: "Scroll",
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
 * Socials is SPEC-ONLY today: both Socials sources are Soon and no events
 * engine exists behind either, so the row states the shape of the answer,
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
 * an event are exactly the modes that call a Socials source — Catalog rails
 * them, Chat is asked about them.
 */
const DISCOVERY_MODE_ENTITIES: Record<
  DiscoveryModeKey,
  readonly DiscoveryEntityKey[]
> = {
  word: ["location", "place"],
  map: ["place"],
  catalog: ["place", "social"],
  swipe: ["place"],
  chat: ["place", "social"],
  favorites: ["place"],
};

/**
 * THE THREE NESTED PLACE TYPES, in the code's own words: `nearby-places.ts`
 * opens with `Google Places ⊃ Mesita Enriched Places ⊃ Mesita Partner
 * Places`, and `PlacesScope = "partners" | "mesita" | "google"` IS this band.
 * `Mesita Listed` retired at MESITA-1856: listing is a row existing, which no
 * mode gates on — enrichment is the gate every mode actually runs.
 */
export const DISCOVERY_POOLS = [
  { key: "google", label: "Google Places" },
  { key: "enriched", label: "Mesita Enriched Places" },
  { key: "partner", label: "Mesita Partnered Places" },
] as const;

export type DiscoveryPoolKey = (typeof DISCOVERY_POOLS)[number]["key"];

/**
 * Filled square = the mode requires that ring. Hollow = not a gate.
 *
 * Relabelling alone would have left two of the three rows dead for every
 * mode, so the mapping moved with the labels (MESITA-1856):
 *
 *   Map        all three — it is the one mode whose GUEST picks the ring,
 *              and `keepListedForScope` refuses an unenriched row before it
 *              even reads the scope, so Enriched is Map's floor and
 *              Partnered its narrowest ring.
 *   Catalog    Google + Enriched. `filters.requireReady` defaults true and
 *   Swipe      Scroll hardcodes it; requireReady IS the enrichment gate —
 *              discovery-filters turns it into `content_state = 'ready'`.
 *   Favorites  Google alone: a bookmark is always a Google-sourced place,
 *              and it is NOT gated on enrichment — bookmarks may include
 *              unenriched Create stubs.
 *   Word, Chat no ring gate at all; they answer from whatever came back.
 */
const DISCOVERY_MODE_POOLS: Record<
  DiscoveryModeKey,
  readonly DiscoveryPoolKey[]
> = {
  word: [],
  map: ["google", "enriched", "partner"],
  catalog: ["google", "enriched"],
  swipe: ["google", "enriched"],
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
  "Mesita Socials Browse Search",
  "Mesita Socials Flexible Search",
] as const;

/**
 * THE ONE SOURCE NO MODE CALLS, named out loud (MESITA-1856).
 *
 * Mesita Places Browse Search lost its only caller at MESITA-1697, when
 * Catalog became Flexible. It left this list then, which made the Matrix
 * report eight sources while Search Sources rendered nine boxes — the box
 * never went anywhere, and a map that under-reports the territory by one is
 * worse than a row of empty marks. So the row is back, off for every mode,
 * and the contract test asserts exactly that: a source is either called by
 * some mode, or it is listed here.
 */
export const DISCOVERY_SOURCES_NO_CALLER = [
  "Mesita Places Browse Search",
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
 *   Browse    no query at all, the catalog itself            → no mode today
 *   Flexible  an arbitrary set of predicates                 → Swipe, Catalog, Chat
 *
 * CATALOG BECAME FLEXIBLE AT MESITA-1697: Home's Feed grew a filter control
 * and the Feed's list lane now cuts its pool with `applyDeckPredicates`
 * before it plans a rail, so it stopped admitting on nothing. That left
 * Places Browse with no caller at all — it keeps its row and its Soon box
 * because it is what any future engine that rails the catalog with no guest
 * input would be (see DISCOVERY_SOURCES_NO_CALLER).
 *
 * THE SOCIALS SOURCES OUTLIVED THE SOCIAL MODE. Socials answer with events a
 * place hosts, not with places, and they lost their own surface when the mode
 * list became six — so the two sources hang off the two modes that can carry
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
  catalog: ["Mesita Places Flexible Search", "Mesita Socials Browse Search"],
  swipe: ["Mesita Places Flexible Search"],
  chat: [
    "Google Places Text Search",
    "Google Places Nearby Search",
    "Mesita Places Flexible Search",
    "Mesita Socials Flexible Search",
  ],
  favorites: [],
} as const;

/** Filled circle = the mode may call that signal. Section 8.3 order. */
const DISCOVERY_MODE_SIGNALS: Record<
  DiscoveryModeKey,
  readonly SignalKey[]
> = {
  word: ["name"],
  map: ["category", "proximity", "timing", "enriched", "partnered", "popularity"],
  catalog: [
    "category",
    "proximity",
    "timing",
    "enriched",
    "partnered",
    "popularity",
    "randomness",
  ],
  swipe: [
    "category",
    "proximity",
    "timing",
    "enriched",
    "partnered",
    "popularity",
    "randomness",
  ],
  chat: [
    "name",
    "summary",
    "category",
    "proximity",
    "timing",
    "enriched",
    "partnered",
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
 * Map / Partnered   Map prices partnership by SPLITTING LANES, not by an
 *                   exponent: `reorderListedLanes` (EF `_shared/
 *                   nearby-lineup.ts`) splits listed rows on
 *                   `isMesitaPartnerRow` and blends each lane independently,
 *                   so `partnered()` is a constant factor inside a lane and
 *                   `s^w` over a constant cannot move a row. The EF twin's
 *                   entry carries the full argument. Editable here, it was a
 *                   knob an operator could save and watch change nothing.
 */
const DISCOVERY_MODE_SIGNAL_ZERO: Partial<
  Record<DiscoveryModeKey, readonly SignalKey[]>
> = {
  map: ["randomness", "partnered"],
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
