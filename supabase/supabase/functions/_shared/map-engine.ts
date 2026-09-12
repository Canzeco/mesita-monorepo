// Map hyperparameters — Discovery › Map (`discovery_config.map`).
//
// Search allowlist for guest map, admin Google Search, Create, and Name
// Google (Fast Autocomplete + Deep Text Search) via Map floors. Nearby
// catalog is closest N of the selected Places set — three nested sets
// (Pato, 2026-09-05): Google Places ⊃ Mesita Enriched Places ⊃ Mesita
// Partner Places. Inner membership paints; it does not add pins. Type batteries
// ride the Google call only. Floors exclude. Name Google categories live
// on discovery_config.name. googleFill AND googleCount > 0 gate Nearby.
//
// Swipe listed admission uses the same type batteries + floors (Pato:
// only Mesita restaurants/partners+listed, never Google-only / types
// Map would not show). Pay / Home catalog keep `discovery_config.filters`.
// A SIGNAL DEMOTES; a MAP FLOOR EXCLUDES.

import type { MapConfig, DiscoveryFilters } from "./discovery-config.ts";
import {
  NEARBY_TYPE_KEYS,
  SUPER_PARAM_KEYS,
  type NearbyTypeKey,
  type SuperParamKey,
} from "./discovery-config.ts";
import { nearbyTypesForSupers } from "./google-type-super.ts";
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
import { familiesForAtlasCategory } from "./place-taxonomy.ts";

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

/**
 * Guest Popularity — Map mode only (MESITA-1790). A Discovery-mode
 * artificial filter: Google review-count floor applied AFTER the catalog
 * is assembled, never as a Nearby API param. Stops match the Filters
 * sheet. 0 = no extra guest cut; operator floors still bind underneath.
 */
export const MAP_MIN_REVIEW_STOPS = [0, 10, 100, 1000, 10000] as const;
export type MapMinReviews = (typeof MAP_MIN_REVIEW_STOPS)[number];

export function parseMapMinReviews(value: unknown): MapMinReviews {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  let best: MapMinReviews = MAP_MIN_REVIEW_STOPS[MAP_MIN_REVIEW_STOPS.length - 1];
  let bestD = Number.POSITIVE_INFINITY;
  for (const stop of MAP_MIN_REVIEW_STOPS) {
    const d = Math.abs(stop - n);
    if (d < bestD || (d === bestD && stop > best)) {
      best = stop;
      bestD = d;
    }
  }
  return best;
}

/** Unknown does not clear a floor that is on — same reading as General. */
export function clearsMinReviews(
  count: number | null | undefined,
  min: number,
): boolean {
  if (!(min > 0)) return true;
  return typeof count === "number" && Number.isFinite(count) && count >= min;
}

export function admitGuestMinReviews<T extends ListedMapRow>(
  listed: T[],
  google: NearbyHit[],
  minReviews: number,
): { listed: T[]; google: NearbyHit[] } {
  if (!(minReviews > 0)) return { listed, google };
  return {
    listed: listed.filter((row) =>
      clearsMinReviews(row.google_review_count, minReviews)
    ),
    google: google.filter((hit) => clearsMinReviews(hit.reviewCount, minReviews)),
  };
}

/** The Supers the operator left on, in param order. */
export function enabledMapSupers(map: MapConfig): SuperParamKey[] {
  return SUPER_PARAM_KEYS.filter((key) => map.supers[key]);
}

/** Their Google batteries, flattened — what one Nearby call asks for. */
export function enabledNearbyTypes(map: MapConfig): NearbyTypeKey[] {
  return nearbyTypesForSupers(enabledMapSupers(map)) as NearbyTypeKey[];
}

/**
 * Client opt-in AND operator fill AND a type battery on. HOW MANY is not
 * asked here — the guest's How many is the only cap (Pato, 2026-08-29);
 * the operator only decides IF Google Nearby may be billed at all.
 */
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
 * MAP FLOORS ONLY. `minReviews` and a numeric `minPopularity` still do not
 * apply here: the Nearby mask now carries `userRatingCount` (Discovery ›
 * General's wipe needs it), but the Map box's review floor stayed a
 * Text-Search/Details question and widening it silently would change what
 * the Map returns without an operator asking. Discovery › General is the
 * knob that cuts Nearby on reviews.
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

// Search + Add share this allowlist. A Super param expands to the Google
// Table A types in that Super (`mexican_restaurant` rides `restaurant`).
//
// ONLY THE THREE F&B SUPERS GATE BY PARAM. Sports, wellness, experiences and
// culture admit whatever the operator has toggled, because that is what they
// did before the param existed: the strip only knew five F&B slugs until
// MESITA-1683, so a listed spa, museum or park has never been gated here.
// Turning the other four into real gates would newly EXCLUDE listed places
// from Search and Add, which is a product decision, not a rename — so the
// carve-out stays explicit until Pato takes it (MESITA-1695).
//
// Guest Super pills send `GOOGLE_SEARCH_TYPES` on Nearby. googleFill is
// Nearby-only and is not a Search/Add gate. Super `undefined` has no battery,
// so listed leftover places still admit.

const PARAM_GATED_FAMILIES = new Set<FamilyKey>([
  "restaurants",
  "bars_nightlife",
  "cafes_bakeries",
]);

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
  const slug = (primaryType ?? "").trim().toLowerCase();
  if (
    slug &&
    (NEARBY_TYPE_KEYS as readonly string[]).includes(slug) &&
    enabled.has(slug as NearbyTypeKey)
  ) {
    return true;
  }
  const families = (() => {
    const atlas = familiesForAtlasCategory(primaryType);
    if (atlas.length > 0) return atlas;
    return familiesForGoogleType(primaryType);
  })();
  if (families.length === 0) return false;
  return families.some((family) => {
    if (!PARAM_GATED_FAMILIES.has(family)) return true;
    if (enabled.size === 0) return false;
    return map.supers[family as SuperParamKey] === true;
  });
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
