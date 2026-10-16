// What Admin Discovery is allowed to say about the live pipeline.
//
// The engines do not dispatch from this table. It is the one description of
// modes, sources, and who calls whom, checked against the call sites in
// discovery-surface.test.ts. The admin console mirrors this file; that
// mirror is pinned by discovery-surface.contract.test.ts.
//
// Routing is fixed. There is no stored primary or fallback order. Deep
// Search calls Autocomplete, Text Search, and Name Search in one pass.
// Chat retrieves nothing. Mesita Social Catalog Search has no engine.

export const DISCOVERY_SOURCE_KEYS = [
  "google_autocomplete",
  "google_text",
  "google_nearby",
  "mesita_name",
  "mesita_nearby",
  "mesita_catalog",
  "mesita_social",
] as const;

export type DiscoverySourceKey = (typeof DISCOVERY_SOURCE_KEYS)[number];

export type SourceAvailability = "live" | "unavailable";

export type DiscoverySourceFact = {
  key: DiscoverySourceKey;
  label: string;
  contributes: string;
  availability: SourceAvailability;
  availabilityLabel: string;
};

export const DISCOVERY_SOURCES: readonly DiscoverySourceFact[] = [
  {
    key: "google_autocomplete",
    label: "Google Places Autocomplete Search",
    contributes: "Suggestions while someone types, including a city or region.",
    availability: "live",
    availabilityLabel: "Live",
  },
  {
    key: "google_text",
    label: "Google Places Text Search",
    contributes: "Places that match a written query, in Google's own order.",
    availability: "live",
    availabilityLabel: "Live",
  },
  {
    key: "google_nearby",
    label: "Google Places Nearby Search",
    contributes: "Places around a map center, bought from Google.",
    availability: "live",
    availabilityLabel: "Live",
  },
  {
    key: "mesita_name",
    label: "Mesita Places Name Search",
    contributes: "Mesita places whose name matches the query.",
    availability: "live",
    availabilityLabel: "Live",
  },
  {
    key: "mesita_nearby",
    label: "Mesita Places Nearby Search",
    contributes: "The closest listed Mesita places around the map.",
    availability: "live",
    availabilityLabel: "Live",
  },
  {
    key: "mesita_catalog",
    label: "Mesita Places Catalog Search",
    contributes:
      "Listed Mesita places, split into family lists or a home deck.",
    availability: "live",
    availabilityLabel: "Live",
  },
  {
    key: "mesita_social",
    label: "Mesita Social Catalog Search",
    contributes: "Events a place hosts. Nothing retrieves them yet.",
    availability: "unavailable",
    availabilityLabel: "Unavailable",
  },
];

export const DISCOVERY_MODE_KEYS = [
  "word",
  "map",
  "catalog",
  "swipe",
  "chat",
  "favorites",
] as const;

export type DiscoverySurfaceModeKey = (typeof DISCOVERY_MODE_KEYS)[number];

export type ModeAvailability = "live" | "unavailable";

export type DiscoveryModeFact = {
  key: DiscoverySurfaceModeKey;
  label: string;
  intent: string;
  input: string;
  selection: string;
  output: string;
  availability: ModeAvailability;
  availabilityLabel: string;
  /** Lineup signals this mode multiplies. One entry means that signal is the whole order. */
  signals: readonly string[];
  /** The runtime reads a stored weight vector for this mode. */
  weightsEditable: boolean;
};

export const DISCOVERY_MODES: readonly DiscoveryModeFact[] = [
  {
    key: "word",
    label: "Word",
    intent: "Find a place, or a city, by what someone types.",
    input: "The text in the search bar.",
    selection:
      "Mesita results follow the name match only. Google results keep Google's order.",
    output:
      "A short list. Autocomplete can include a city or region. Text search returns places.",
    availability: "live",
    availabilityLabel: "Live",
    signals: ["name"],
    weightsEditable: false,
  },
  {
    key: "map",
    label: "Map",
    intent: "See places around the map.",
    input:
      "The center of the map, the place set the guest picks, and how many pins.",
    selection:
      "Distance, unless Google returns nothing. Then Mesita pins are reordered by category, proximity, timing, enrichment, and popularity.",
    output: "Pins, and the same places in the row under the search bar.",
    availability: "live",
    availabilityLabel: "Live",
    signals: ["category", "proximity", "timing", "enriched", "popularity"],
    weightsEditable: true,
  },
  {
    key: "catalog",
    label: "Catalog",
    intent: "Browse places by family.",
    input: "An optional location. Family chooses the list. It does not score.",
    selection:
      "One shared profile: proximity, popularity, and randomness. Enrichment decides who may enter.",
    output:
      "One list for each guest family. A place in two families is in both.",
    availability: "live",
    availabilityLabel: "Live",
    signals: ["proximity", "popularity", "randomness"],
    weightsEditable: false,
  },
  {
    key: "swipe",
    label: "Swipe",
    intent: "A deck of places to save or skip.",
    input: "The guest's location, when they allow it, and their own filters.",
    selection:
      "Open now and distance form bands. Inside a band, category, proximity, timing, enrichment, popularity, and randomness reorder.",
    output: "The home card stack.",
    availability: "live",
    availabilityLabel: "Live",
    signals: [
      "category",
      "proximity",
      "timing",
      "enriched",
      "popularity",
      "randomness",
    ],
    weightsEditable: true,
  },
  {
    key: "chat",
    label: "Chat",
    intent: "Ask for advice in a conversation.",
    input: "The messages so far.",
    selection: "No place ranking. The reply is text.",
    output: "A written answer. It does not return a list of places.",
    availability: "unavailable",
    availabilityLabel: "Unavailable",
    signals: [],
    weightsEditable: false,
  },
  {
    key: "favorites",
    label: "Favorites",
    intent: "Revisit saved places.",
    input: "The places this guest saved.",
    selection: "No ranking. Saves are shown as they are.",
    output: "A grid of saved places.",
    availability: "live",
    availabilityLabel: "Live",
    signals: [],
    weightsEditable: false,
  },
];

/** Sources a mode actually calls. Empty means it calls none. Not editable. */
export const DISCOVERY_MODE_SOURCES: Record<
  DiscoverySurfaceModeKey,
  readonly DiscoverySourceKey[]
> = {
  word: ["google_autocomplete", "google_text", "mesita_name"],
  map: ["google_nearby", "mesita_nearby"],
  catalog: ["mesita_catalog"],
  swipe: ["mesita_catalog"],
  chat: [],
  favorites: [],
};

export const DISCOVERY_ROUTING_EDITABLE = false;

export const CATALOG_FAMILY_FACTS: readonly { key: string; label: string }[] = [
  { key: "coffee", label: "Coffee" },
  { key: "breakfast", label: "Breakfast" },
  { key: "quick_bite", label: "Quick bite" },
  { key: "pizza", label: "Pizza" },
  { key: "tacos", label: "Tacos" },
  { key: "sushi", label: "Sushi" },
  { key: "burgers", label: "Burgers" },
  { key: "noodles", label: "Noodles" },
  { key: "dinner", label: "Dinner" },
  { key: "sweet", label: "Sweet" },
  { key: "drinks", label: "Drinks" },
  { key: "night_out", label: "Night out" },
  { key: "go_out", label: "Go out" },
  { key: "move", label: "Move" },
  { key: "feel_better", label: "Feel better" },
];

export function sourceByKey(key: DiscoverySourceKey): DiscoverySourceFact {
  const found = DISCOVERY_SOURCES.find((s) => s.key === key);
  if (!found) throw new Error(`unknown source ${key}`);
  return found;
}

export function modesCallingSource(
  key: DiscoverySourceKey,
): DiscoverySurfaceModeKey[] {
  return DISCOVERY_MODE_KEYS.filter((mode) =>
    DISCOVERY_MODE_SOURCES[mode].includes(key)
  );
}

export function modeCallsSource(
  mode: DiscoverySurfaceModeKey,
  source: DiscoverySourceKey,
): boolean {
  return DISCOVERY_MODE_SOURCES[mode].includes(source);
}
