// Map filters — Search only. Family + Places scope + Popularity
// (Google review-count floor). How many is operator `map.pinCount`.
//
// TWO NESTED SETS (Pato, 2026-09-05):
//
//   Google Places  ⊃  Mesita Enriched Places
//      gray                    red
//
// A superset chain, not overlapping circles — so the control is a
// cumulative ladder and the figure is concentric rings. ENRICHMENT GATES
// THE MESITA RING (`enriched_at` set, MESITA-2154): Created and Requested
// places were never a search source, so a Mesita row nobody has enriched is
// outside the Mesita ring and reads gray — reachable only where a Google
// hit is that place (the Google ring), on Word and on Favorites.
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
export type MapPlacesScope = "mesita" | "google";

/** The inner ring: the places Mesita has written up. */
export const MAP_PLACES_SCOPE_DEFAULT: MapPlacesScope = "mesita";

/**
 * The stops, narrowest first. `tick` is what the radio says; the names
 * are Pato's own words, and they fit because the legend stacks instead of
 * sitting side by side.
 */
export const MAP_SEARCH_STOPS = [
  {
    key: "mesita",
    tick: "Mesita Enriched Places",
    label: "Mesita Enriched Places",
    hint: "Mesita Enriched Places only",
  },
  {
    key: "google",
    tick: "Google Places",
    label: "Google Places",
    hint: "Google Places, Mesita places included",
  },
] as const satisfies readonly {
  key: MapPlacesScope;
  tick: string;
  label: string;
  hint: string;
}[];

/** Google review-count floor. Mirror `_shared/map-engine.ts`. */
export const MAP_MIN_REVIEW_STOPS = [0, 10, 100, 1000, 10000] as const;
export type MapMinReviews = (typeof MAP_MIN_REVIEW_STOPS)[number];
const MAP_MIN_REVIEWS_DEFAULT: MapMinReviews = 0;

export type MapFilters = {
  /** Which of the two nested sets. Default is the inner ring. */
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
 * Absent, unknown, and legacy values all resolve to the inner ring. A
 * persisted blob from before 2026-09-05 carries an ordinal, and `1` meant
 * "Mesita Places" there, so the numerics keep their OLD meanings rather
 * than being reinterpreted under the new law. A blob carrying a ring word
 * the law no longer has lands on the default too, not on the wider one.
 */
export function parsePlacesScope(value: unknown): MapPlacesScope {
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    if (key === "mesita" || key === "google") return key;
    const legacy = Number(key);
    if (key.length > 0 && Number.isFinite(legacy)) {
      return legacy >= 2 ? "google" : MAP_PLACES_SCOPE_DEFAULT;
    }
    return MAP_PLACES_SCOPE_DEFAULT;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 2 ? "google" : MAP_PLACES_SCOPE_DEFAULT;
  }
  return MAP_PLACES_SCOPE_DEFAULT;
}

/**
 * The narrowest ring a place belongs to. The Mesita ring is enriched-only —
 * the server's `enriched` (`enriched_at` set, MESITA-2154), never
 * `content_state` — and that is what keeps the ring the same set the colour
 * promises. A Created or Requested Mesita row is in the Google ring: the
 * server only sends one when a Google hit IS that place, painted gray in
 * the hit's slot, so it counts there and never in the Mesita ring.
 */
export function placeSearchScope(place: Place): MapPlacesScope {
  if (place.googleOnly || place.from_google) return "google";
  return isEnrichedPlace(place) ? "mesita" : "google";
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
