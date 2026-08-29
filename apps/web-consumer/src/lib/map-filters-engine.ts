// Map filters — Search only. Status + Category cut the nearby catalog.
// Distance and time stay off this surface: the camera and Search here
// already bound the set. Swipe keeps the Discovery store.

import type { Place } from "@/lib/api/places";
import { type FamilyKey } from "@/lib/place-families";

export const MAP_STATUS_KEYS = [
  "not_on_mesita",
  "created",
  "requested",
  "enriched",
  "partnered",
  "promoted",
] as const;

export type MapStatusKey = (typeof MAP_STATUS_KEYS)[number];

export const MAP_STATUS_OPTIONS = [
  { key: "not_on_mesita", label: "Not on Mesita" },
  { key: "created", label: "Created" },
  { key: "requested", label: "Requested" },
  { key: "enriched", label: "Enriched" },
  { key: "partnered", label: "Partnered" },
  { key: "promoted", label: "Promoted" },
] as const satisfies readonly { key: MapStatusKey; label: string }[];

export type MapFilters = {
  /** Exclusive buckets; empty = every status. */
  statuses: MapStatusKey[];
  familyKeys: FamilyKey[];
  categories: string[];
};

export const MAP_FILTER_DEFAULTS: MapFilters = {
  statuses: [],
  familyKeys: [],
  categories: [],
};

/** Highest rung wins so a place has one status on the map. */
export function placeMapStatus(place: Place): MapStatusKey {
  if (place.googleOnly || place.from_google) return "not_on_mesita";
  if (place.promoting === true) return "promoted";
  if (place.partner === true) return "partnered";
  if (place.content_status === "ready" || Boolean(place.enriched_at)) {
    return "enriched";
  }
  const requests = Number(place.request_count);
  if (Number.isFinite(requests) && requests > 0) return "requested";
  return "created";
}

export function mapFiltersAreActive(f: MapFilters): boolean {
  return mapFilterCount(f) > 0;
}

/** Each selected Status, family, or type is one applied filter. */
export function mapFilterCount(f: MapFilters): number {
  return f.statuses.length + f.familyKeys.length + f.categories.length;
}

function matchesMapFilters(place: Place, f: MapFilters): boolean {
  if (f.statuses.length > 0 && !f.statuses.includes(placeMapStatus(place))) {
    return false;
  }

  if (f.familyKeys.length > 0 || f.categories.length > 0) {
    const categoryHit =
      f.categories.length > 0 &&
      place.category != null &&
      f.categories.includes(place.category);
    const familyHit =
      f.familyKeys.length > 0 &&
      f.familyKeys.some((key) => (place.family_keys ?? []).includes(key));
    if (!categoryHit && !familyHit) return false;
  }

  return true;
}

/** Same-array passthrough when nothing is selected, for memo stability. */
export function applyMapFilters(places: Place[], f: MapFilters): Place[] {
  if (!mapFiltersAreActive(f)) return places;
  return places.filter((place) => matchesMapFilters(place, f));
}
