// Map filters — Search only: the family chips, All or ONE family
// (MESITA-2412). The guest never picks a source: the Map is a view of the
// Area pool, Google and Mesita places in one ranked set (MESITA-2379). How
// many and the Map's Popularity root are the operator's, Admin › Discovery
// (the circle is the screen's; MESITA-3086); there is no guest Filters sheet
// (MESITA-2417).
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
export type MapPlacesScope = "google" | "mesita";

/** Search's two non-family modes, as on Home (MESITA-4592): Saved shows the
 *  guest's saved places, Nearby every family around the guest. */
export type MapSpecial = "saved" | "nearby";

export type MapFilters = {
  /** Families: the twenty guest families; empty = All Families. */
  familyKeys: FamilyKey[];
  /** Saved or Nearby; null = Popular or a family. */
  special: MapSpecial | null;
};

export const MAP_FILTER_DEFAULTS: MapFilters = {
  familyKeys: [],
  special: null,
};

/**
 * The scope a row belongs to on this surface. A Google stub is Google's
 * alone; every other row is a Mesita place. The pin TONE still tells
 * Premier's red from gray (`placePinTone`) — that is the colour's
 * promise, not the set.
 */
export function placeSearchScope(place: Place): MapPlacesScope {
  if (place.googleOnly || place.from_google) return "google";
  return "mesita";
}
