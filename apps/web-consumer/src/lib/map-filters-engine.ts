// Map filters — Search only. A Places power bar + Super Category cut
// the nearby catalog. There is no Types axis and no category slug list.
//
// Power is cumulative, not a multi-select: Partners ⊂ Partners+Places ⊂
// Partners+Places+Google. Mesita Places is the enriched profile only —
// Created and Requested stubs are not a search source. A Super Category
// is a SET of categories; a category may sit in two (breakfast is
// restaurants AND cafés). The cut is OR: a place matches if any of its
// Super Categories is selected. The Search chrome uses the guest word
// Category for the same six families. Distance and time stay off this
// surface: the camera already bounds the set. Swipe keeps Discovery.

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

export type MapSearchLane = "partners" | "places" | "google";

export const MAP_SEARCH_POWER_MIN = 1;
export const MAP_SEARCH_POWER_MAX = 3;
export type MapSearchPower = 1 | 2 | 3;

/** Three stops. Ticks are short; the caption is the cumulative union. */
export const MAP_SEARCH_STOPS = [
  {
    power: 1,
    key: "partners",
    tick: "Partners",
    label: "Mesita Partners",
  },
  {
    power: 2,
    key: "places",
    tick: "+ Places",
    label: "Mesita Places",
  },
  {
    power: 3,
    key: "google",
    tick: "+ Google",
    label: "Google Places",
  },
] as const satisfies readonly {
  power: MapSearchPower;
  key: MapSearchLane;
  tick: string;
  label: string;
}[];

const LANE_POWER: Record<MapSearchLane, MapSearchPower> = {
  partners: 1,
  places: 2,
  google: 3,
};

export type MapFilters = {
  /** 1 = Partners, 2 = + Mesita Places, 3 = + Google. Default is 3. */
  searchPower: MapSearchPower;
  /** Super Category: the six place families; empty = no constraint. */
  familyKeys: FamilyKey[];
};

export const MAP_FILTER_DEFAULTS: MapFilters = {
  searchPower: MAP_SEARCH_POWER_MAX,
  familyKeys: [],
};

export function clampSearchPower(value: unknown): MapSearchPower {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return MAP_SEARCH_POWER_MAX;
  if (n <= 1) return 1;
  if (n >= 3) return 3;
  return 2;
}

export function searchPowerCaption(power: MapSearchPower): string {
  if (power <= 1) return "Mesita Partners";
  if (power === 2) return "Mesita Partners & Mesita Places";
  return "Mesita Partners & Mesita Places & Google Places";
}

/** Highest rung wins so a place has one atlas status. */
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

/**
 * Search source for the power bar. Created and Requested return null —
 * Mesita Places is enriched only, never a thin stub.
 */
export function placeSearchLane(place: Place): MapSearchLane | null {
  const status = placeMapStatus(place);
  if (status === "not_on_mesita") return "google";
  if (status === "promoted" || status === "partnered") return "partners";
  if (status === "enriched") return "places";
  return null;
}

export function mapFiltersAreActive(f: MapFilters): boolean {
  return mapFilterCount(f) > 0;
}

/** A pulled-back power bar counts as one filter; each Super Category is one. */
export function mapFilterCount(f: MapFilters): number {
  const power = f.searchPower < MAP_SEARCH_POWER_MAX ? 1 : 0;
  return power + f.familyKeys.length;
}

function matchesMapFilters(place: Place, f: MapFilters): boolean {
  const lane = placeSearchLane(place);
  if (!lane) return false;
  if (LANE_POWER[lane] > f.searchPower) return false;

  if (f.familyKeys.length > 0) {
    const familyHit = f.familyKeys.some((key) =>
      (place.family_keys ?? []).includes(key),
    );
    if (!familyHit) return false;
  }

  return true;
}

/** Same-array passthrough when every row already matches, for memo stability. */
export function applyMapFilters(places: Place[], f: MapFilters): Place[] {
  const next = places.filter((place) => matchesMapFilters(place, f));
  return next.length === places.length ? places : next;
}
