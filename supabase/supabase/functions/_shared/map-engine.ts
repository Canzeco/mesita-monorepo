// Map hyperparameters — Discovery › Map (`discovery_config.map`).
//
// Search allowlist for guest map, admin Google Search, Create, and Name
// Google (Fast Autocomplete + Deep Text Search) via Map floors. The guest
// has TWO SCOPES (MESITA-2298) over the internal sets (Google Places ⊃
// Mesita Places): Google Places is what Nearby returned inside
// `map.radiusKm`, a Mesita owner painting its hit. Mesita Selected, the
// third set, died with MESITA-2925. Type batteries ride the
// Google call only. Floors exclude. There is no Google reviews minimum
// (MESITA-2721): the Area pipeline's Popularity floor is the cut. Name Google
// categories live on discovery_config.name. The Area pipeline calls no
// Google (Nearby retired, MESITA-2872).
//
// `minPopularity` reads the Area pipeline's Popularity (pipeline-signals.ts,
// rating × saturating volume since MESITA-2347).
// A SIGNAL DEMOTES; a MAP FLOOR EXCLUDES.

import type { MapConfig, SignalParams } from "./discovery-config.ts";
import { SUPER_PARAM_KEYS, type SuperParamKey } from "./discovery-config.ts";
import { nearbyTypesForSupers } from "./google-type-super.ts";
import { popularity, POPULARITY_HALF_REVIEWS_DEFAULT } from "./pipeline-signals.ts";
import { type EligibilityResult, familiesForGoogleType } from "./sourcing.ts";
import { familiesForAtlasCategory } from "./place-taxonomy.ts";

export type ListedMapRow = {
  google_place_id?: string | null;
  google_stars_overall?: number | null;
  google_review_count?: number | null;
};


/** Every guest family. Stored switches do not turn a family off. */
export function enabledMapSupers(_map: MapConfig): SuperParamKey[] {
  return [...SUPER_PARAM_KEYS];
}

/** Their Google batteries, flattened — what one Nearby call asks for. */
export function enabledNearbyTypes(map: MapConfig): string[] {
  return nearbyTypesForSupers(enabledMapSupers(map));
}

/**
 * The Map popularity floor, on the Area pipeline's Popularity: 0..1 with
 * the operator's reviews-for-half-credit (`params.popularity.halfReviews`).
 * An unrated place scores 0, so any floor above 0 drops it, the same
 * reading as a Google stub.
 */
export function listedClearsMapPopularity(
  place: ListedMapRow,
  map: MapConfig,
  params?: SignalParams["popularity"],
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

export function primaryTypeClearsMapTypes(
  primaryType: string | null | undefined,
  map: MapConfig,
): boolean {
  const enabled = new Set(enabledNearbyTypes(map));
  const slug = (primaryType ?? "").trim().toLowerCase();
  if (slug && enabled.has(slug)) return true;
  // Undefined is not a family (MESITA-2962): the Atlas twin answers
  // ["undefined"] for a salon or a gym, and counting that as a family let a
  // guest's open mint "Hello Salon".
  const families = (() => {
    const atlas = familiesForAtlasCategory(primaryType).filter((f) => f !== "undefined");
    if (atlas.length > 0) return atlas;
    return familiesForGoogleType(primaryType);
  })();
  return families.length > 0;
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
