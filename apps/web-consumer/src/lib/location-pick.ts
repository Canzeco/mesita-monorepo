// A location search result → a saved location (MESITA-2383, MESITA-2464).
//
// A REGION (a city, a neighbourhood, a postcode) whose anchor has a viewport
// saves an AREA with that rectangle: Places keeps what is inside it. A place,
// a street address or anything else saves a POINT: Places ranks by distance.
// A Location row has no coordinates until one anchor resolve on pick; a
// place row may already carry them.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  apiResolveLocationAnchor,
  type PlacePrediction,
} from "@/lib/api/place-search";
import type { LocationBounds } from "@/lib/saved-locations";

/** Google types that name a region, not a spot (MESITA-2383). */
const REGION_TYPE = /^(locality|sublocality(_level_\d)?|neighborhood|colloquial_area|administrative_area_level_\d|postal_code)$/;

/** True when the pick is a region and should save as an area. */
export function isRegionPick(row: Pick<PlacePrediction, "kind" | "locationType">): boolean {
  return row.kind === "location" && REGION_TYPE.test(row.locationType ?? "");
}

export type LocationPick = {
  name: string;
  lat: number;
  lng: number;
  bounds: LocationBounds | null;
};

/** The pick's name and coordinates, plus its rectangle when it is a region. */
export async function resolveLocationPick(
  supabase: SupabaseClient,
  row: PlacePrediction,
): Promise<LocationPick> {
  if (typeof row.lat === "number" && typeof row.lng === "number") {
    return { name: row.mainText, lat: row.lat, lng: row.lng, bounds: null };
  }
  const anchor = await apiResolveLocationAnchor(supabase, row.placeId);
  return {
    name: row.mainText,
    lat: anchor.lat,
    lng: anchor.lng,
    bounds: isRegionPick(row) ? anchor.viewport : null,
  };
}
