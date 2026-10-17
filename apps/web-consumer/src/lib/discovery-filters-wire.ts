// The guest's predicates, on the wire (MESITA-1153, shape MESITA-1792).
//
// Web sends Family, Places scope, and Google review floor.

import type { DiscoveryFilters } from "@/lib/discovery-filters-engine";
import { hasDiscoveryPredicates } from "@/lib/discovery-filters-engine";

export type DiscoveryPredicatesWire = {
  familyKeys: string[];
  placesScope: DiscoveryFilters["placesScope"];
  minReviews: number;
};

type DeckCenter = { lat: number; lng: number } | null;

export function toDiscoveryPredicatesWire(
  f: DiscoveryFilters,
): DiscoveryPredicatesWire {
  return {
    familyKeys: [],
    placesScope: f.placesScope,
    minReviews: 0,
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
  return [f.placesScope, where].join("|");
}
