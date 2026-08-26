// Map hyperparameters — Discovery › Map (`discovery_config.map`).
//
// The nearby catalog is closest 20 listed ∪ one Nearby Search of 20.
// These knobs decide WHICH of those may appear and WHICH primary types
// ride that one Google call. They do not raise the cap.
//
// Floors are Map-only. Swipe / Pay / Home keep `discovery_config.filters`.
// A SIGNAL DEMOTES; a MAP FLOOR EXCLUDES. Popularity as a floor is the
// honest exception to "every filter is a query predicate": the score is a
// function, not a column, so it runs after the listed fetch and before the
// merge, the same way `trimToRadius` finishes a bounding box.

import type { MapConfig, DiscoveryFilters } from "./discovery-config.ts";
import { NEARBY_TYPE_KEYS, type NearbyTypeKey } from "./discovery-config.ts";
import {
  popularity,
  type SignalParamBag,
  type SignalPlace,
} from "./discovery-signals.ts";
import type { NearbyHit } from "./nearby-places.ts";

export type { NearbyTypeKey };

export type ListedMapRow = {
  google_place_id?: string | null;
  google_stars_overall?: number | null;
  google_review_count?: number | null;
};

function popPlace(
  rating: number | null,
  reviews: number | null,
): SignalPlace {
  return {
    lat: null,
    lng: null,
    hours: null,
    category: null,
    rating,
    user_ratings_total: reviews,
    embedding: null,
  };
}

/** Stricter of global operator filters and Map floors, for the listed query. */
export function listedMapFilters(
  global: DiscoveryFilters,
  map: MapConfig,
): DiscoveryFilters {
  return {
    ...global,
    minRating: Math.max(global.minRating, map.minRating),
    minReviews: Math.max(global.minReviews, map.minReviews),
  };
}

export function enabledNearbyTypes(map: MapConfig): NearbyTypeKey[] {
  return NEARBY_TYPE_KEYS.filter((key) => map.types[key]);
}

/** Client opt-in AND operator googleFill AND at least one type battery on. */
export function mapShouldFillGoogle(
  clientOptIn: boolean,
  map: MapConfig,
): boolean {
  return clientOptIn && map.googleFill && enabledNearbyTypes(map).length > 0;
}

export function listedClearsMapPopularity(
  place: ListedMapRow,
  map: MapConfig,
  params?: SignalParamBag,
): boolean {
  if (!(map.minPopularity > 0)) return true;
  const score = popularity(
    popPlace(place.google_stars_overall ?? null, place.google_review_count ?? null),
    undefined,
    params,
  );
  return score >= map.minPopularity;
}

/**
 * Google Nearby has no review count on the field mask. minReviews and a
 * numeric minPopularity therefore cannot be proven and do not apply.
 * A rating or popularity floor still excludes an unrated stub — those are
 * the empty yellow pins. minRating compares the Nearby star field.
 */
export function googleHitClearsMapFloors(
  hit: NearbyHit,
  map: MapConfig,
  _params?: SignalParamBag,
): boolean {
  if (map.minRating > 0) {
    if (hit.rating == null || hit.rating < map.minRating) return false;
  }
  if (map.minPopularity > 0 && hit.rating == null) return false;
  return true;
}

/**
 * Drop listed rows that miss minPopularity, and do not let Google paint the
 * same Place ID as a stub. Google hits still have to clear Map floors.
 */
export function admitMapCatalog<T extends ListedMapRow>(
  listed: T[],
  google: NearbyHit[],
  map: MapConfig,
  params?: SignalParamBag,
): { listed: T[]; google: NearbyHit[] } {
  const admittedListed: T[] = [];
  const rejectedGids = new Set<string>();
  for (const row of listed) {
    if (listedClearsMapPopularity(row, map, params)) {
      admittedListed.push(row);
    } else if (row.google_place_id) {
      rejectedGids.add(row.google_place_id);
    }
  }
  const admittedGoogle = google.filter(
    (hit) =>
      !rejectedGids.has(hit.placeId) &&
      googleHitClearsMapFloors(hit, map, params),
  );
  return { listed: admittedListed, google: admittedGoogle };
}
