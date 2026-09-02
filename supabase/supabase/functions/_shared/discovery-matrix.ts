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
// retrieval survives as the two Social sources below.
//
// NINE SOURCES (section 8.2). `Search` survives only where it quotes an
// endpoint Google itself named that way, plus the Mesita four that mirror
// them. Perplexity is not a Source: Chat has no external retrieval behind it.

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
 * What a mode can put IN FRONT OF THE GUEST. A Place is a venue; a Location
 * is a region or a city — name, type, and the coordinates the next step
 * needs (Pato, 2026-09-02).
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
export const DISCOVERY_MODE_ENTITIES: Record<
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

export const DISCOVERY_MODE_POOLS: Record<
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
 * Locked mode → sources.
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
 * place hosts, not with places, and it lost its own surface when the mode list
 * became six — so its two sources hang off the two modes that can carry an
 * event: Catalog rails it, Chat is asked about it. Both are still Soon; no
 * events engine exists.
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
