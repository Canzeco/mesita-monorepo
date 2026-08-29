// Map filters — Search only. The two Places sets + Super Category + How
// many cut the nearby catalog. There is no Types axis and no category
// slug list.
//
// Scope is TWO nested sets (Pato, 2026-08-29): Mesita Places ⊂ Google
// Places. Partners retired as a scope — a partner is a Mesita Place
// painted yellow. Default is Mesita Places, the enriched profile only —
// Created and Requested stubs are not a search source. A Super Category
// is a SET of categories; a category may sit in two (breakfast is
// restaurants AND cafés). The cut is OR: a place matches if any of its
// Super Categories is selected. Distance and time stay off this
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

export type MapSearchLane = "places" | "google";

export type MapSearchPower = 1 | 2;
/** Mesita Places — the whole listed set. Partners are a paint, not a set. */
export const MAP_SEARCH_POWER_DEFAULT: MapSearchPower = 1;

/**
 * TWO nested sets (Pato, 2026-08-29): Mesita Places ⊂ Google Places.
 * The pin colours survive the retired Partners scope: partner pins stay
 * yellow, Mesita red, Google gray — colour is membership paint, never a
 * filter.
 */
export const MAP_SEARCH_STOPS = [
  {
    power: 1,
    key: "places",
    tick: "Mesita Places",
    label: "Mesita Places",
    hint: "Mesita Places only",
  },
  {
    power: 2,
    key: "google",
    tick: "Google Places",
    label: "Google Places",
    hint: "Mesita Places and Google Places",
  },
] as const satisfies readonly {
  power: MapSearchPower;
  key: MapSearchLane;
  tick: string;
  label: string;
  hint: string;
}[];

const LANE_POWER: Record<MapSearchLane, MapSearchPower> = {
  places: 1,
  google: 2,
};

/** Closest-N stops on Search Filters. Nothing in between. */
export const MAP_RESULT_LIMITS = [20, 40, 60] as const;
export type MapResultLimit = (typeof MAP_RESULT_LIMITS)[number];
/** How many is a CAP, so it opens at the smallest one (Pato, 2026-08-29). */
export const MAP_RESULT_LIMIT_DEFAULT: MapResultLimit = 20;

export type MapFilters = {
  /** 1 = Mesita Places, 2 = + Google Places. Default is 1. */
  searchPower: MapSearchPower;
  /** Super Category: the six place families; empty = no constraint. */
  familyKeys: FamilyKey[];
  /** Closest N after scope + Super. 20, 40, or 60. */
  resultLimit: MapResultLimit;
};

export const MAP_FILTER_DEFAULTS: MapFilters = {
  searchPower: MAP_SEARCH_POWER_DEFAULT,
  familyKeys: [],
  resultLimit: MAP_RESULT_LIMIT_DEFAULT,
};

export function clampResultLimit(value: unknown): MapResultLimit {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return MAP_RESULT_LIMIT_DEFAULT;
  let best: MapResultLimit = MAP_RESULT_LIMIT_DEFAULT;
  let bestD = Number.POSITIVE_INFINITY;
  for (const stop of MAP_RESULT_LIMITS) {
    const d = Math.abs(stop - n);
    // Ties go up so 30 → 40 and 50 → 60, never a value between stops.
    if (d < bestD || (d === bestD && stop > best)) {
      best = stop;
      bestD = d;
    }
  }
  return best;
}

/** Closest N after membership. Always distance-sorts, then slices. */
export function takeMapResultLimit<T extends { distance_km?: number | null }>(
  places: T[],
  limit: MapResultLimit,
): T[] {
  const cap = clampResultLimit(limit);
  const sorted = [...places].sort(
    (a, b) =>
      (a.distance_km ?? Number.POSITIVE_INFINITY) -
      (b.distance_km ?? Number.POSITIVE_INFINITY),
  );
  return sorted.length <= cap ? sorted : sorted.slice(0, cap);
}

export function clampSearchPower(value: unknown): MapSearchPower {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return MAP_SEARCH_POWER_DEFAULT;
  // Legacy persisted 3 (the old Google stop) folds to 2; the retired
  // Partners stop (old 1) reads as Mesita Places.
  return n >= 2 ? 2 : 1;
}

export function searchPowerCaption(power: MapSearchPower): string {
  if (power <= 1) return "Mesita Places";
  return "Mesita Places & Google Places";
}

/** A stop is in view when the selected power reaches it. */
export function searchPowerIncludes(
  lanePower: MapSearchPower,
  selected: MapSearchPower,
): boolean {
  return lanePower <= selected;
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
 * Search source for the Places scope. Created and Requested return null —
 * Mesita Places is enriched only, never a thin stub.
 */
export function placeSearchLane(place: Place): MapSearchLane | null {
  const status = placeMapStatus(place);
  if (status === "not_on_mesita") return "google";
  // Partners are Mesita Places — yellow paint, not a lane of their own.
  if (status === "promoted" || status === "partnered") return "places";
  if (status === "enriched") return "places";
  return null;
}

export function mapFiltersAreActive(f: MapFilters): boolean {
  return mapFilterCount(f) > 0;
}

/** Leaving + Places, each Super Category, or a How many stop, counts as one. */
export function mapFilterCount(f: MapFilters): number {
  const power = f.searchPower === MAP_SEARCH_POWER_DEFAULT ? 0 : 1;
  const howMany = f.resultLimit === MAP_RESULT_LIMIT_DEFAULT ? 0 : 1;
  return power + f.familyKeys.length + howMany;
}

function matchesMapFilters(place: Place, f: MapFilters): boolean {
  const lane = placeSearchLane(place);
  if (!lane) return false;
  if (LANE_POWER[lane] > f.searchPower) return false;

  // Super Category does not cut Google stubs — they have no reliable
  // Super Category cuts Mesita rows and Google stubs. Google membership
  // is the one Super of the Nearby primaryType (family_keys on the stub).
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
