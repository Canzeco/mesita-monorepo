// Map filters — Search only: the family chips, All or ONE family
// (MESITA-2412). The guest never picks a source: the Map is a view of the
// Area pool, Google and Mesita places in one ranked set (MESITA-2379). How
// many, the circle (`map.radiusKm`) and the Google reviews minimum
// (`map.googleMinReviews`) are the operator's, Admin › Discovery; there is
// no guest Filters sheet (MESITA-2417).
//
// The pin tones still tell a Google-only place from a Mesita one
// (`search-pins.ts`, `placeSearchScope`); that is the colour's promise, not
// a filter.
//
// The SERVER is the one selector (MESITA-1699 law kept): SearchClient
// posts the family keys and paints what comes back.

import type { Place } from "@/lib/api/places";
import { type FamilyKey } from "@/lib/place-families";

/** Which set a pin belongs to: a Google-only stub, or a Mesita place. */
export type MapPlacesScope = "google" | "selected";

export type MapFilters = {
  /** Families: the fifteen guest families; empty = All Families. */
  familyKeys: FamilyKey[];
};

export const MAP_FILTER_DEFAULTS: MapFilters = {
  familyKeys: [],
};

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
