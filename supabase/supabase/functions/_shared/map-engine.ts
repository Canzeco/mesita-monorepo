// Map hyperparameters — Discovery › Map (`discovery_config.map`).
//
// Search allowlist for guest map, admin Google Search, Create, and Name
// Google (Fast Autocomplete + Deep Text Search) via Map floors. The guest
// has TWO SCOPES (MESITA-2298) over the internal sets (Google Places ⊃
// Mesita Places): Google Places is what Nearby returned inside
// `map.radiusKm`, a Mesita owner painting its hit. Mesita Selected, the
// third set, died with MESITA-2925. Floors exclude. There is no Google reviews minimum
// (MESITA-2721): the Area pipeline's Popularity floor is the cut. Name Google
// categories live on discovery_config.name. The Area pipeline calls no
// Google (Nearby retired, MESITA-2872).
//
// `minPopularity` reads the Area pipeline's Popularity (pipeline-signals.ts,
// rating × saturating volume since MESITA-2347).
// A SIGNAL DEMOTES; a MAP FLOOR EXCLUDES.

import type { MapConfig } from "./discovery-config.ts";
import { popularity, POPULARITY_HALF_REVIEWS_DEFAULT } from "./pipeline-signals.ts";
import { type EligibilityResult, familiesForGoogleType } from "./sourcing.ts";

export type ListedMapRow = {
  google_place_id?: string | null;
  google_stars_overall?: number | null;
  google_review_count?: number | null;
};


/**
 * The Map popularity floor, on the old 0..1 Popularity with a half credit
 * at K reviews (the constant 100 since MESITA-3083: the stored
 * `params.popularity.halfReviews` was read by nothing and retired; a caller
 * may still pass its own K). An unrated place scores 0, so any floor above
 * 0 drops it, the same reading as a Google stub.
 */
export function listedClearsMapPopularity(
  place: ListedMapRow,
  map: MapConfig,
  params?: { halfReviews?: number },
): boolean {
  if (!(map.minPopularity > 0)) return true;
  const score = popularity(
    {
      rating: place.google_stars_overall ?? null,
      reviewCount: place.google_review_count ?? null,
    },
    params?.halfReviews ?? POPULARITY_HALF_REVIEWS_DEFAULT,
  );
  return score >= map.minPopularity;
}

export type MapPlaceSignals = {
  primaryType: string | null;
  rating: number | null;
  reviewCount: number | null;
};

/**
 * THE category gate (MESITA-2974): a Google type is on Mesita when the type
 * map gives it a guest family. Undefined is not one, so salons, gyms, shops
 * and hotels fail here. It used to run three paths — the Nearby batteries,
 * the retired Atlas category twin and this map — and the twin's
 * ["undefined"] let a guest's open mint "Hello Salon" (MESITA-2962). Atlas's
 * switch (`catalog_membership.enabled`, read by Create) must say the same;
 * the weekly pipeline audit flags them apart (PA-MEMBERSHIP-DRIFT:gate).
 */
export function primaryTypeClearsMapTypes(
  primaryType: string | null | undefined,
): boolean {
  return familiesForGoogleType(primaryType).length > 0;
}

/** Text Search / Place Details / Create — full rating + review signals. */
export function evaluatePlaceForMap(
  map: MapConfig,
  signals: MapPlaceSignals,
): EligibilityResult {
  if (!primaryTypeClearsMapTypes(signals.primaryType)) {
    return {
      eligible: false,
      code: "family_not_eligible",
      reason: "This kind of place isn't one of Mesita's place types (Discovery's place rules).",
    };
  }
  if (
    map.minRating > 0 &&
    (signals.rating === null || signals.rating < map.minRating)
  ) {
    return {
      eligible: false,
      code: "below_min_rating",
      reason:
        `This place doesn't meet Mesita's minimum Google rating (${map.minRating}★).`,
    };
  }
  if (
    map.minReviews > 0 &&
    (signals.reviewCount === null || signals.reviewCount < map.minReviews)
  ) {
    return {
      eligible: false,
      code: "below_min_reviews",
      reason:
        `This place doesn't have enough Google reviews yet (min ${map.minReviews}).`,
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
      reason:
        `This place doesn't meet Mesita's minimum popularity (${map.minPopularity}).`,
    };
  }
  return { eligible: true };
}
