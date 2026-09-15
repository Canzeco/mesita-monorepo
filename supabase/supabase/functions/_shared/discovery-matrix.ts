// Discovery mode × entity × pool × source × signal matrix.
//
// SPEC MIRROR, NOT A DISPATCHER. Twin of admin
// `apps/web-admin/.../filters-config/catalog.ts` DISCOVERY_MODE_*. Change one,
// change the other. Vercel root is apps/web-admin so that bundle cannot import
// this file. Do not dispatch from modeCallsSource.
//
// TWO NOUNS, AND ONLY TWO: a **Mode** is a guest Discovery surface, a
// **Source** is a retrieval mechanism a mode calls. `module` is retired —
// these things do not modularize anything, they fetch. Spanish decided it:
// *modo / módulo* differ by two letters, *modo / fuente* cannot be confused.
//
// SIX MODES (Notion Docs > Discovery section 8.1). Word is the searchbar —
// fast, deep, and the one mode that can answer with a Location. Map is the
// pins. They share a screen and are still two modes, because they answer with
// different sets from different sources. Social left the mode list; its
// retrieval survives as the two Socials sources below.
//
// NINE SOURCES (section 8.2). `Search` survives only where it quotes an
// endpoint Google itself named that way, plus the Mesita four that mirror
// them. Perplexity is not a Source: Chat has no external retrieval behind it.
// Eight of the nine have a caller; Mesita Places Browse Search has none and
// says so in ink, one row of empty marks — see DISCOVERY_SOURCES_NO_CALLER.

import {
  SIGNAL_KEYS,
  type SignalKey,
} from "./discovery-signals.ts";

export const DISCOVERY_MODE_KEYS = [
  "word",
  "map",
  "catalog",
  "swipe",
  "chat",
  "favorites",
] as const;

export type DiscoveryModeKey = (typeof DISCOVERY_MODE_KEYS)[number];

/**
 * What a mode can put IN FRONT OF THE GUEST. A Place is a place; a Location
 * is a region or a city — name, type, and the coordinates the next step
 * needs (Pato, 2026-09-02). A Social is an event a place hosts, which is a
 * different answer from the place itself and never merges into one list
 * with it (MESITA-1856). Socials is SPEC-ONLY today: both Socials sources
 * are Soon and there is no events engine behind either.
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
 * Socials follows the same rule one band down: the modes that can answer
 * with an event are exactly the modes that call a Socials source — Catalog
 * rails them, Chat is asked about them.
 */
export const DISCOVERY_MODE_ENTITIES: Record<
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
 * Places`, and `PlacesScope = "partners" | "mesita" | "google"` IS this
 * band. `Mesita Listed` retired at MESITA-1856: listing is a row existing,
 * which no mode gates on — enrichment is the gate every mode actually runs.
 */
export const DISCOVERY_POOLS = [
  { key: "google", label: "Google Places" },
  { key: "enriched", label: "Mesita Enriched Places" },
  { key: "partner", label: "Mesita Partnered Places" },
] as const;

export type DiscoveryPoolKey = (typeof DISCOVERY_POOLS)[number]["key"];

/**
 * Which rings a mode demands. Relabelling alone would have left two of the
 * three rows dead for every mode, so the mapping moved with the labels
 * (MESITA-1856):
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
export const DISCOVERY_MODE_POOLS: Record<
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
 * Locked mode → sources.
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
 * CATALOG BECAME FLEXIBLE AT MESITA-1697, and this is the reclassification
 * that came with it. The rule never changed — a source is Flexible when the
 * guest hands it predicates — but Catalog's surface (Home's Feed) grew a
 * filter control, and `consumer-web-list-catalog` now cuts its pool with
 * `applyDeckPredicates` before it plans a single rail. It stopped admitting on
 * nothing, so it stopped being Browse.
 *
 * This block used to read "SWIPE IS FLEXIBLE, NOT BROWSE, and the difference
 * is the guest's own filter sheet". That contrast is retired rather than
 * wrong: both modes now carry one. Places Browse currently has no mode at
 * all, and it is kept in the table because it is what any future engine that
 * rails the catalog with no guest input would be.
 *
 * THE SOCIALS SOURCES OUTLIVED THE SOCIAL MODE. Socials answer with events a
 * place hosts, not with places, and they lost their own surface when the mode
 * list became six — so the two sources hang off the two modes that can carry
 * an event: Catalog rails it, Chat is asked about it. Both are still Soon; no
 * events engine exists.
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

export const DISCOVERY_MODE_SIGNALS: Record<
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

export const DISCOVERY_MODE_SIGNAL_ZERO: Partial<
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

/** Off and zero → exponent 0. On → stored weight. */
export function weightsForMode(
  mode: DiscoveryModeKey,
  global: Record<SignalKey, number>,
): Record<SignalKey, number> {
  const out = {} as Record<SignalKey, number>;
  for (const key of SIGNAL_KEYS) {
    const state = modeSignalState(mode, key);
    out[key] = state === "on" ? global[key] ?? 0 : 0;
  }
  return out;
}
