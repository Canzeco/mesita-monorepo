// The guest's predicates, on the wire (MESITA-1153, shape MESITA-1792).
//
// Web sends Super Category, Places scope, and Google review floor. The EF
// still reads the retired visit/when/distance fields so a deployed Expo binary
// that posts the old payload keeps working.

import type { DiscoveryFilters } from "@/lib/discovery-filters-engine";
import { hasDiscoveryPredicates } from "@/lib/discovery-filters-engine";

export type DiscoveryPredicatesWire = {
  familyKeys: string[];
  placesScope: DiscoveryFilters["placesScope"];
  minReviews: number;
};

export type DeckCenter = { lat: number; lng: number } | null;

export type DeckRequest = {
  limit: number;
  lat?: number;
  lng?: number;
  predicates?: DiscoveryPredicatesWire;
};

export function toDiscoveryPredicatesWire(
  f: DiscoveryFilters,
): DiscoveryPredicatesWire {
  return {
    familyKeys: [...f.familyKeys],
    placesScope: f.placesScope,
    minReviews: f.minReviews,
  };
}

export function toDeckRequest(
  f: DiscoveryFilters,
  center: DeckCenter,
  limit: number,
): DeckRequest {
  if (!hasDiscoveryPredicates(f)) {
    return {
      limit,
      ...(center ? { lat: center.lat, lng: center.lng } : {}),
    };
  }
  return {
    limit,
    ...(center ? { lat: center.lat, lng: center.lng } : {}),
    predicates: toDiscoveryPredicatesWire(f),
  };
}

export const UNFILTERED_DECK_KEY = "-";

export function deckRequestKey(
  f: DiscoveryFilters,
  center: DeckCenter,
): string {
  const where = center
    ? `${center.lat.toFixed(3)},${center.lng.toFixed(3)}`
    : "";
  if (!hasDiscoveryPredicates(f)) {
    return where || UNFILTERED_DECK_KEY;
  }
  return [
    [...f.familyKeys].sort().join("+"),
    f.placesScope,
    f.minReviews,
    where,
  ].join("|");
}
