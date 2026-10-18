// Map filters — Search only. Families + Google Reviews (MESITA-2384).
// The guest never picks a source: the Map is a view of the Area pool, Google
// and Mesita places in one ranked set (MESITA-2379). How many is the
// operator's (`map.mesitaPlaces`, one Google call per load); the circle is
// operator `map.radiusKm`.
//
// The pin tones still tell a Google-only place from a Mesita one
// (`search-pins.ts`, `placeSearchScope`); that is the colour's promise, not
// a filter.
//
// Families is All Families (the default: no family cut) or any set of the
// fifteen; the server turns the set into the union of their Google types.
// Google Reviews is the review-COUNT floor, 10+ / 100+ / 1,000+,
// default 100+; applied by the server to Google hits after Google answers,
// never as a Nearby API param, never a refill, and never to a Mesita row.
//
// The SERVER is the one selector (MESITA-1699 law kept): SearchClient
// posts these three params and paints what comes back. Distance and time
// stay off this surface: the camera already bounds the set.

import type { Place } from "@/lib/api/places";
import { type FamilyKey } from "@/lib/place-families";

/** Which set a pin belongs to: a Google-only stub, or a Mesita place. */
export type MapPlacesScope = "google" | "selected";

/**
 * Google review-count floor: 10+ · 100+ · 1,000+, default 100+ (MESITA-2298;
 * Pato set the minimum at 10+, MESITA-2336, so there is no 0+ stop). Mirror
 * `_shared/map-engine.ts`. A count of people, never stars; applied after
 * Google answers, and never to Mesita Selected.
 */
export const MAP_MIN_REVIEW_STOPS = [10, 100, 1000] as const;
export type MapMinReviews = (typeof MAP_MIN_REVIEW_STOPS)[number];
const MAP_MIN_REVIEWS_DEFAULT: MapMinReviews = 100;

export type MapFilters = {
  /** Families: the fifteen guest families; empty = All Families. */
  familyKeys: FamilyKey[];
  /** Minimum Google reviews: 10, 100 or 1,000; the default is 100. */
  minReviews: MapMinReviews;
};

export const MAP_FILTER_DEFAULTS: MapFilters = {
  familyKeys: [],
  minReviews: MAP_MIN_REVIEWS_DEFAULT,
};

export function clampMinReviews(value: unknown): MapMinReviews {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return MAP_MIN_REVIEWS_DEFAULT;
  // The lowest stop is the floor: a stored 0 (the retired 0+) lands on 10+.
  if (n <= MAP_MIN_REVIEW_STOPS[0]) return MAP_MIN_REVIEW_STOPS[0];
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
 * The scope a row belongs to on this surface. A Google stub is Google's
 * alone; every Mesita row the server sends here is Mesita Selected. The
 * pin TONE still tells red from ink (`placePinTone`) — that is the colour's
 * promise, not the sheet's set.
 */
export function placeSearchScope(place: Place): MapPlacesScope {
  if (place.googleOnly || place.from_google) return "google";
  return "selected";
}

export function mapFiltersAreActive(f: MapFilters): boolean {
  return mapFilterCount(f) > 0;
}

/** Each Family, or leaving the default Google Reviews stop, counts as one. */
export function mapFilterCount(f: MapFilters): number {
  const reviews = f.minReviews === MAP_MIN_REVIEWS_DEFAULT ? 0 : 1;
  return f.familyKeys.length + reviews;
}
