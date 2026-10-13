// Map filters — Search only. Family + Places scope + Popularity
// (Google review-count floor). How many is operator `map.pinCount`.
//
// THREE NESTED SETS (Pato, 2026-10-12, MESITA-2158):
//
//   Google Places  ⊃  Mesita Places  ⊃  Mesita Enriched Places
//      gray              ink                 red
//
// A superset chain, not overlapping circles — so the control is a
// cumulative ladder and the figure is concentric rings. Mesita Places is
// every Mesita place a guest can reach (listed, profile ready), enriched or
// not; ENRICHMENT GATES ONLY THE INNER RING (`enriched_at` set,
// MESITA-2154), so a Created place reads ink until an Enrich run completes.
// Default is Mesita Enriched Places, the inner ring — a discovery surface
// opens on the places Mesita has actually written up.
//
// Popularity is a Discovery-mode artificial filter (Pato, 2026-09-12):
// the Map mode drops rows whose Google review count is below the stop
// AFTER the catalog is assembled, never as a Google Nearby API param.
// Stops: 0 / 10 / 100 / 1000 / 10000. Default 0 = no extra guest cut;
// operator floors still bind underneath.
//
// The SERVER is the one selector (MESITA-1699 law kept): SearchClient
// posts these three params and paints what comes back.
// Distance and time stay off this surface: the camera already bounds
// the set. Swipe keeps DiscoveryFilters.

import type { Place } from "@/lib/api/places";
import { isEnrichedPlace } from "@/lib/place-enriched";
import { type FamilyKey } from "@/lib/place-families";

/** The set the guest picked. Named, never an ordinal — the wire carries
 *  this word, and two callers post no scope at all. */
export type MapPlacesScope = "enriched" | "mesita" | "google";

/** The inner ring: the places Mesita has written up. */
export const MAP_PLACES_SCOPE_DEFAULT: MapPlacesScope = "enriched";

/** Outer to inner — the order Pato named them. A guest picks one. */
const MAP_PLACES_SCOPES = [
  "google",
  "mesita",
  "enriched",
] as const satisfies readonly MapPlacesScope[];

/**
 * The stops, widest first, in Pato's own order. `tick` is what the radio
 * says; the names are Pato's own words, and they fit because the legend
 * stacks instead of sitting side by side. `ring` is the set the dot and the
 * glyph paint — the key itself here, and a different word only where
 * another sheet reuses the control with its own wire (Feed/Scroll).
 */
export const MAP_SEARCH_STOPS = [
  {
    key: "google",
    ring: "google",
    tick: "Google Places",
    label: "Google Places",
    hint: "Google Places, every Mesita place included",
  },
  {
    key: "mesita",
    ring: "mesita",
    tick: "Mesita Places",
    label: "Mesita Places",
    hint: "Mesita Places, enriched or not",
  },
  {
    key: "enriched",
    ring: "enriched",
    tick: "Mesita Enriched Places",
    label: "Mesita Enriched Places",
    hint: "Mesita Enriched Places only",
  },
] as const satisfies readonly PlacesScopeStop<MapPlacesScope>[];

/** One radio on a Places-scope control. */
export type PlacesScopeStop<K extends string> = {
  key: K;
  /** The nested set this stop paints, for the dot and the glyph. */
  ring: MapPlacesScope;
  tick: string;
  label: string;
  hint: string;
};

/** Google review-count floor. Mirror `_shared/map-engine.ts`. */
export const MAP_MIN_REVIEW_STOPS = [0, 10, 100, 1000, 10000] as const;
export type MapMinReviews = (typeof MAP_MIN_REVIEW_STOPS)[number];
const MAP_MIN_REVIEWS_DEFAULT: MapMinReviews = 0;

export type MapFilters = {
  /** Which of the three nested sets. Default is the inner ring. */
  placesScope: MapPlacesScope;
  /** Family: the seven real place families; empty = no constraint. */
  familyKeys: FamilyKey[];
  /** Minimum Google reviews. 0 = any. */
  minReviews: MapMinReviews;
};

export const MAP_FILTER_DEFAULTS: MapFilters = {
  placesScope: MAP_PLACES_SCOPE_DEFAULT,
  familyKeys: [],
  minReviews: MAP_MIN_REVIEWS_DEFAULT,
};

export function clampMinReviews(value: unknown): MapMinReviews {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return MAP_MIN_REVIEWS_DEFAULT;
  let best: MapMinReviews = MAP_MIN_REVIEW_STOPS[MAP_MIN_REVIEW_STOPS.length - 1];
  let bestD = Number.POSITIVE_INFINITY;
  for (const stop of MAP_MIN_REVIEW_STOPS) {
    const d = Math.abs(stop - n);
    if (d < bestD || (d === bestD && stop > best)) {
      best = stop;
      bestD = d;
    }
  }
  return best;
}

/**
 * Absent and unknown values resolve to the inner ring. A persisted blob
 * from before 2026-09-05 carries an ordinal, and `1` meant "Mesita Places"
 * there — a ring that exists again (MESITA-2158), so the numerics keep
 * their OLD meanings: 1 and below are Mesita Places, 2 and up Google. A
 * blob carrying a ring word the law no longer has lands on the default,
 * not on a wider one. A blob from before MESITA-2158 that says `mesita`
 * meant the enriched ring then and gets Mesita Places now — wider, and
 * harmless.
 */
export function parsePlacesScope(value: unknown): MapPlacesScope {
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    if ((MAP_PLACES_SCOPES as readonly string[]).includes(key)) {
      return key as MapPlacesScope;
    }
    const legacy = Number(key);
    if (key.length > 0 && Number.isFinite(legacy)) {
      return legacy >= 2 ? "google" : "mesita";
    }
    return MAP_PLACES_SCOPE_DEFAULT;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 2 ? "google" : "mesita";
  }
  return MAP_PLACES_SCOPE_DEFAULT;
}

/**
 * The narrowest ring a place belongs to. Enriched is the server's
 * `enriched` (`enriched_at` set, MESITA-2154), never `content_state`, and
 * that is what keeps the inner ring the same set the red promises. Any
 * other Mesita row — a Created place, which the server sends on the two
 * wider rings — is Mesita Places. A Google stub is Google's alone.
 */
export function placeSearchScope(place: Place): MapPlacesScope {
  if (place.googleOnly || place.from_google) return "google";
  return isEnrichedPlace(place) ? "enriched" : "mesita";
}

/**
 * Places each ring would show, from the catalog in hand. Cumulative — the
 * sets nest, so an enriched row counts in all three rings and a Created
 * row in Mesita and Google. Always enriched ≤ mesita ≤ google.
 */
export function placesScopeCounts(
  places: readonly Place[],
): Record<MapPlacesScope, number> {
  let enriched = 0;
  let mesita = 0;
  for (const place of places) {
    const ring = placeSearchScope(place);
    if (ring === "enriched") enriched += 1;
    if (ring !== "google") mesita += 1;
  }
  return { enriched, mesita, google: places.length };
}

export function mapFiltersAreActive(f: MapFilters): boolean {
  return mapFilterCount(f) > 0;
}

/** Leaving the default ring, each Family, or a Popularity stop, counts as one. */
export function mapFilterCount(f: MapFilters): number {
  const scope = f.placesScope === MAP_PLACES_SCOPE_DEFAULT ? 0 : 1;
  const popularity = f.minReviews === MAP_MIN_REVIEWS_DEFAULT ? 0 : 1;
  return scope + f.familyKeys.length + popularity;
}
