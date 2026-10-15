// Discovery filter engine — Feed and Scroll (MESITA-1792).
//
// Same three guest params as the Search map (MESITA-1790), plus one extra:
// connect current location. Nothing else. The old intent stack — Where
// search, distance slider, When, and category chips — is gone from this
// sheet.
//
//   · Family — the twenty guest families; empty = no constraint.
//   · Scope          — two nested sets: Google ⊃ Mesita Enriched. Default is
//                      the inner ring. On Feed/Scroll the pool is listed
//                      Mesita places, so Google == all enriched; the ring
//                      still names the same sets the map uses.
//   · Google reviews — review-count floor 0 / 10 / 100 / 1000 / 10000.
//                      Guest copy: 0 / 10+ / 100+ / 1K+ / 10K+. Missing
//                      count fails a floor above 0.
//
// Location is not a predicate: it only grants coordinates for ranking.
// Predicates CUT, signals RANK, and a predicate cuts first.

import {
  clampMinReviews,
  type MapMinReviews,
  type PlacesScopeStop,
} from "@/lib/map-filters-engine";
import { type FamilyKey } from "@/lib/place-families";

export type DiscoveryPlacesScope = "mesita" | "google";

const DISCOVERY_PLACES_SCOPE_DEFAULT: DiscoveryPlacesScope = "mesita";

/**
 * This sheet's two radios, narrowest first. Its `mesita` is the ENRICHED
 * ring — Feed/Scroll's pool is the Enriched gate — so the dot and glyph
 * paint it red. The Map's own Mesita Places ring (MESITA-2158) is not a
 * set this pool can hold, so it is not offered here.
 */
export const DISCOVERY_SCOPE_STOPS = [
  {
    key: "mesita",
    ring: "enriched",
    tick: "Mesita Enriched Places",
    label: "Mesita Enriched Places",
    hint: "Mesita Enriched Places only",
  },
  {
    key: "google",
    ring: "google",
    tick: "Google Places",
    label: "Google Places",
    hint: "Google Places, Mesita places included",
  },
] as const satisfies readonly PlacesScopeStop<DiscoveryPlacesScope>[];

// Popularity floor: the same stops and nearest-stop rule as the map's, so one
// copy serves both.
export type DiscoveryReviewFloor = MapMinReviews;
export const clampReviewFloor = clampMinReviews;

export function parsePlacesScope(value: unknown): DiscoveryPlacesScope {
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    if (key === "mesita" || key === "google") return key;
  }
  // Unknown words land on the default — including whatever ring a persisted
  // v6 blob may still carry.
  return DISCOVERY_PLACES_SCOPE_DEFAULT;
}

export type DiscoveryFilters = {
  familyKeys: FamilyKey[];
  placesScope: DiscoveryPlacesScope;
  minReviews: DiscoveryReviewFloor;
};

export const DISCOVERY_FILTER_DEFAULTS: DiscoveryFilters = {
  familyKeys: [],
  placesScope: DISCOVERY_PLACES_SCOPE_DEFAULT,
  minReviews: 0,
};

export function hasDiscoveryPredicates(f: DiscoveryFilters): boolean {
  return (
    f.familyKeys.length > 0 ||
    f.placesScope !== DISCOVERY_PLACES_SCOPE_DEFAULT ||
    f.minReviews > 0
  );
}

export function countAppliedDiscoveryFilters(f: DiscoveryFilters): number {
  let n = 0;
  if (f.familyKeys.length > 0) n += 1;
  if (f.placesScope !== DISCOVERY_PLACES_SCOPE_DEFAULT) n += 1;
  if (f.minReviews > 0) n += 1;
  return n;
}
