// Catalog filter engine.
//
//   · Family — the fifteen guest families; empty = no constraint.
//   · Places — Mesita Enriched Places, then Mesita Places. Default is the
//     inner ring. Google Places is not a catalog set.
//
// The Google review floor belongs to Search. A stored floor is ignored.
// Location is not a predicate: it only grants coordinates for ranking.
// Predicates CUT, signals RANK, and a predicate cuts first.

import {
  clampMinReviews,
  type MapMinReviews,
  type PlacesScopeStop,
} from "@/lib/map-filters-engine";
import { type FamilyKey } from "@/lib/place-families";

export type DiscoveryPlacesScope = "enriched" | "mesita";

const DISCOVERY_PLACES_SCOPE_DEFAULT: DiscoveryPlacesScope = "enriched";

/** Inner ring first. Catalog never offers Google Places. */
export const DISCOVERY_SCOPE_STOPS = [
  {
    key: "enriched",
    ring: "enriched",
    tick: "Mesita Enriched Places",
    label: "Mesita Enriched Places",
    hint: "Mesita Enriched Places only",
  },
  {
    key: "mesita",
    ring: "mesita",
    tick: "Mesita Places",
    label: "Mesita Places",
    hint: "Mesita Places, enriched or not",
  },
] as const satisfies readonly PlacesScopeStop<DiscoveryPlacesScope>[];

// Popularity floor: the same stops and nearest-stop rule as the map's, so one
// copy serves both.
export type DiscoveryReviewFloor = MapMinReviews;
export const clampReviewFloor = clampMinReviews;

export function parsePlacesScope(value: unknown): DiscoveryPlacesScope {
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    if (key === "mesita" || key === "enriched") return key;
  }
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
    f.placesScope !== DISCOVERY_PLACES_SCOPE_DEFAULT
  );
}

export function countAppliedDiscoveryFilters(f: DiscoveryFilters): number {
  let n = 0;
  if (f.familyKeys.length > 0) n += 1;
  if (f.placesScope !== DISCOVERY_PLACES_SCOPE_DEFAULT) n += 1;
  return n;
}
