// Where the pin picker opens (MESITA-2501). A pick never saves anything by
// itself any more: it only frames the map, and the guest confirms the pin.
//
// A REGION (a city, a neighbourhood, a postcode) whose anchor has a viewport
// opens fitted to it; a place or an address opens close on its point. A
// Location row has no coordinates until one anchor resolve on pick; a place
// row may already carry them.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  apiResolveLocationAnchor,
  type NearbyArea,
  type PlacePrediction,
} from "@/lib/api/place-search";

/** Google types that name a region, not a spot (MESITA-2383). */
const REGION_TYPE = /^(locality|sublocality(_level_\d)?|neighborhood|colloquial_area|administrative_area_level_\d|postal_code)$/;

/** True when the pick is a region: the picker fits its viewport. */
export function isRegionPick(row: Pick<PlacePrediction, "kind" | "locationType">): boolean {
  return row.kind === "location" && REGION_TYPE.test(row.locationType ?? "");
}

export type LatLng = { lat: number; lng: number };
export type Bounds = { low: LatLng; high: LatLng };

/** The picker's first camera: a centre and either a zoom or a box to fit. */
export type PickerCamera = { center: LatLng; zoom: number; fit?: Bounds };

/** A place row that already has its point: close on it. */
export const PLACE_PICK_ZOOM = 17;
/** An address or any Location without a viewport. */
export const LOCATION_PICK_ZOOM = 16;

/** The picker's camera for a search match. */
export async function pickCamera(
  supabase: SupabaseClient,
  row: PlacePrediction,
): Promise<PickerCamera> {
  if (typeof row.lat === "number" && typeof row.lng === "number") {
    return { center: { lat: row.lat, lng: row.lng }, zoom: PLACE_PICK_ZOOM };
  }
  const anchor = await apiResolveLocationAnchor(supabase, row.placeId);
  const center = { lat: anchor.lat, lng: anchor.lng };
  return isRegionPick(row) && anchor.viewport
    ? { center, zoom: LOCATION_PICK_ZOOM, fit: anchor.viewport }
    : { center, zoom: LOCATION_PICK_ZOOM };
}

/** An "Around you" row (MESITA-2471): its level picks the zoom; a city
 *  fits its own rectangle. */
export function aroundYouCamera(area: NearbyArea): PickerCamera {
  const center = { lat: area.lat, lng: area.lng };
  if (area.level === "neighborhood") return { center, zoom: 15 };
  if (area.level === "district") return { center, zoom: 14 };
  return { center, zoom: 13, fit: area.bounds };
}
