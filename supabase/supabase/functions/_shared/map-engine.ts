// Map hyperparameters — Discovery › Map (`discovery_config.map`).
//
// Search allowlist for guest map, admin Google Search, Create, and Name
// Google (Fast Autocomplete + Deep Text Search) via Map floors. Nearby
// catalog is three closest-N lanes (partners, Mesita, Google) merged
// after dropping overlaps. Type batteries ride the Google call only.
// Floors exclude. Name Google categories live on discovery_config.name.
// googleFill AND googleCount > 0 gate the billed Nearby call.
//
// Swipe listed admission uses the same type batteries + floors (Pato:
// only Mesita restaurants/partners+listed, never Google-only / types
// Map would not show). Pay / Home catalog keep `discovery_config.filters`.
// A SIGNAL DEMOTES; a MAP FLOOR EXCLUDES.

import type { MapConfig, DiscoveryFilters } from "./discovery-config.ts";
import { NEARBY_TYPE_KEYS, type NearbyTypeKey } from "./discovery-config.ts";
import {
  popularity,
  type SignalParamBag,
  type SignalPlace,
} from "./discovery-signals.ts";
import type { NearbyHit } from "./nearby-places.ts";
import {
  familiesForGoogleType,
  type EligibilityResult,
  type FamilyKey,
} from "./sourcing.ts";

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

/** Client opt-in AND operator fill AND googleCount > 0 AND a type battery on. */
export function mapShouldFillGoogle(
  clientOptIn: boolean,
  map: MapConfig,
): boolean {
  return (
    clientOptIn &&
    map.googleFill &&
    map.googleCount > 0 &&
    enabledNearbyTypes(map).length > 0
  );
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
 * Drop listed rows that miss minPopularity. Google Nearby stays nearest-N
 * and does not shrink because a Place ID is Mesita-related — merge drops
 * only IDs that already won a Partner or Mesita slot. Google hits still
 * have to clear Map floors.
 */
export function admitMapCatalog<T extends ListedMapRow>(
  listed: T[],
  google: NearbyHit[],
  map: MapConfig,
  params?: SignalParamBag,
): { listed: T[]; google: NearbyHit[] } {
  const admittedListed = listed.filter((row) =>
    listedClearsMapPopularity(row, map, params)
  );
  const admittedGoogle = google.filter((hit) =>
    googleHitClearsMapFloors(hit, map, params)
  );
  return { listed: admittedListed, google: admittedGoogle };
}

/**
 * Swipe pool: listed Mesita rows that clear Map types + popularity.
 * Partners and listed (web) both stay — `listing_type` is not a gate.
 * Never takes Google hits; Swipe does not fill.
 */
export type SwipeListedRow = ListedMapRow & {
  category?: string | null;
};

export function admitSwipeCatalog<T extends SwipeListedRow>(
  listed: T[],
  map: MapConfig,
  params?: SignalParamBag,
): T[] {
  const typed = listed.filter((row) =>
    primaryTypeClearsMapTypes(row.category, map),
  );
  return admitMapCatalog(typed, [], map, params).listed;
}

// Search + Add share this allowlist. A Nearby type battery expands to
// the Google Table A types in that family (`mexican_restaurant` rides
// `restaurant`). Wellness / experiences / culture have no battery, so
// they cannot appear and cannot be added. googleFill is Nearby-only
// and is not a Search/Add gate.

const FAMILY_NEARBY_TYPES: Record<FamilyKey, readonly NearbyTypeKey[]> = {
  restaurants: ["restaurant"],
  bars_nightlife: ["bar", "night_club"],
  cafes_bakeries: ["cafe", "bakery"],
  wellness_spa: [],
  experiences: [],
  culture_arts: [],
};

export type MapPlaceSignals = {
  primaryType: string | null;
  rating: number | null;
  reviewCount: number | null;
};

export function primaryTypeClearsMapTypes(
  primaryType: string | null | undefined,
  map: MapConfig,
): boolean {
  const enabled = new Set(enabledNearbyTypes(map));
  if (enabled.size === 0) return false;
  const slug = (primaryType ?? "").trim().toLowerCase();
  if (
    slug &&
    (NEARBY_TYPE_KEYS as readonly string[]).includes(slug) &&
    enabled.has(slug as NearbyTypeKey)
  ) {
    return true;
  }
  return familiesForGoogleType(primaryType).some((family) =>
    FAMILY_NEARBY_TYPES[family].some((key) => enabled.has(key)),
  );
}

/** Text Search / Place Details / Create — full rating + review signals. */
export function evaluatePlaceForMap(
  map: MapConfig,
  signals: MapPlaceSignals,
): EligibilityResult {
  if (!primaryTypeClearsMapTypes(signals.primaryType, map)) {
    return {
      eligible: false,
      code: "family_not_eligible",
      reason: "This kind of place isn't in Discovery › Map.",
    };
  }
  if (map.minRating > 0 && (signals.rating === null || signals.rating < map.minRating)) {
    return {
      eligible: false,
      code: "below_min_rating",
      reason: `This place doesn't meet Mesita's minimum Google rating (${map.minRating}★).`,
    };
  }
  if (
    map.minReviews > 0 &&
    (signals.reviewCount === null || signals.reviewCount < map.minReviews)
  ) {
    return {
      eligible: false,
      code: "below_min_reviews",
      reason: `This place doesn't have enough Google reviews yet (min ${map.minReviews}).`,
    };
  }
  if (
    map.minPopularity > 0 &&
    !listedClearsMapPopularity(
      {
        google_stars_overall: signals.rating,
        google_review_count: signals.reviewCount,
      },
      map,
    )
  ) {
    return {
      eligible: false,
      code: "below_min_popularity",
      reason: `This place doesn't meet Mesita's minimum popularity (${map.minPopularity}).`,
    };
  }
  return { eligible: true };
}
