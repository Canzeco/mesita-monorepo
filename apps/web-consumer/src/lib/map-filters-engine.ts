// Map filters — Search only. Status + Super Category cut the nearby
// catalog. There is no Types axis and no category slug list. A Super
// Category is a SET of categories; a category may sit in two (breakfast
// is restaurants AND cafés). The cut is OR: a place matches if any of
// its Super Categories is selected. The Search chrome uses the guest
// word Category for the same six families. Distance and time stay off
// this surface: the camera already bounds the set. Swipe keeps Discovery.

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
  /** Super Category: the six place families; empty = no constraint. */
  familyKeys: FamilyKey[];
};

export const MAP_FILTER_DEFAULTS: MapFilters = {
  statuses: [],
  familyKeys: [],
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

/** Each selected Status or Super Category is one applied filter. */
export function mapFilterCount(f: MapFilters): number {
  return f.statuses.length + f.familyKeys.length;
}

function matchesMapFilters(place: Place, f: MapFilters): boolean {
  if (f.statuses.length > 0 && !f.statuses.includes(placeMapStatus(place))) {
    return false;
  }

  if (f.familyKeys.length > 0) {
    const familyHit = f.familyKeys.some((key) =>
      (place.family_keys ?? []).includes(key),
    );
    if (!familyHit) return false;
  }

  return true;
}

/** Same-array passthrough when nothing is selected, for memo stability. */
export function applyMapFilters(places: Place[], f: MapFilters): Place[] {
  if (!mapFiltersAreActive(f)) return places;
  return places.filter((place) => matchesMapFilters(place, f));
}
