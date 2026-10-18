// Map hyperparameters — Discovery › Map (`discovery_config.map`).
//
// Search allowlist for guest map, admin Google Search, Create, and Name
// Google (Fast Autocomplete + Deep Text Search) via Map floors. The guest
// has TWO SCOPES (MESITA-2298) over the three internal sets (Google
// Places ⊃ Mesita Places ⊃ Mesita Enriched Places): Google Places is what
// Nearby returned inside `map.radiusKm`, a Mesita owner painting its hit;
// Mesita Selected is the enriched, ready rows. Type batteries ride the
// Google call only. Floors exclude. The guest Google Reviews floor cuts
// Google hits only, after Google answers (`guestReviewFloor`). Name Google
// categories live on discovery_config.name. `googleFill` gates Nearby.
//
// `minPopularity` reads the Area pipeline's Popularity (pipeline-signals.ts)
// since the old seven-signal library retired (MESITA-2328). Listed rows
// without a Google ask keep `discovery_config.filters`.
// A SIGNAL DEMOTES; a MAP FLOOR EXCLUDES.

import type {
  DiscoveryFilters,
  MapConfig,
  SignalParams,
} from "./discovery-config.ts";
import {
  NEARBY_TYPE_KEYS,
  type NearbyTypeKey,
  SUPER_PARAM_KEYS,
  type SuperParamKey,
} from "./discovery-config.ts";
import { nearbyTypesForSupers } from "./google-type-super.ts";
import {
  popularity,
  POPULARITY_REFERENCE_RATING_DEFAULT,
  POPULARITY_REFERENCE_REVIEWS_DEFAULT,
} from "./pipeline-signals.ts";
import type { NearbyHit, PlacesScope } from "./nearby-places.ts";
import { type EligibilityResult, familiesForGoogleType } from "./sourcing.ts";
import { familiesForAtlasCategory } from "./place-taxonomy.ts";

export type ListedMapRow = {
  google_place_id?: string | null;
  google_stars_overall?: number | null;
  google_review_count?: number | null;
};

/**
 * Stricter of global operator filters and Map floors, for the Mesita
 * Selected query (MESITA-2298).
 *
 * `requireReady` is the Enriched gate (`enriched_at IS NOT NULL` AND
 * `content_state = 'ready'`). Mesita Selected IS that set today, so the
 * gate is always on here whatever the global toggle says: a Created row is
 * not Selected, and a guest has no scope that would show it.
 */
export function listedMapFilters(
  global: DiscoveryFilters,
  map: MapConfig,
): DiscoveryFilters {
  return {
    ...global,
    requireReady: true,
    minRating: Math.max(global.minRating, map.minRating),
    minReviews: Math.max(global.minReviews, map.minReviews),
  };
}

/**
 * Guest Google Reviews — Map mode only (MESITA-1790). A Discovery-mode
 * artificial filter: Google review-COUNT floor applied AFTER Google's
 * response, never as a Nearby API param, never a refill, and never to
 * Mesita Selected (MESITA-2298). Stops match the Filters sheet: 10+ · 100+ ·
 * 1,000+ (Pato set the minimum at 10+, MESITA-2336, so the Google Places
 * scope never admits a hit with fewer than 10 reviews). A silent client gets
 * the sheet's default, 100+; a 0 or any value under 10 lands on 10+.
 */
export const MAP_MIN_REVIEW_STOPS = [10, 100, 1000] as const;
export type MapMinReviews = (typeof MAP_MIN_REVIEW_STOPS)[number];
export const MAP_MIN_REVIEWS_DEFAULT: MapMinReviews = 100;

export function parseMapMinReviews(value: unknown): MapMinReviews {
  if (value === undefined || value === null) return MAP_MIN_REVIEWS_DEFAULT;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return MAP_MIN_REVIEWS_DEFAULT;
  if (n <= MAP_MIN_REVIEW_STOPS[0]) return MAP_MIN_REVIEW_STOPS[0];
  let best: MapMinReviews =
    MAP_MIN_REVIEW_STOPS[MAP_MIN_REVIEW_STOPS.length - 1];
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

/**
 * THE ONLY way a caller obtains the guest's review floor (MESITA-2298 §2).
 * Google Places: the sheet's stop, applied after Google answers on
 * `hit.reviewCount` (`clearsMinReviews`); a silent client gets the
 * default, 100+. Mesita Selected: ALWAYS 0 — no review floor of any kind
 * gates a Selected row, so by construction no branch can grow one.
 */
export function guestReviewFloor(
  scope: PlacesScope,
  raw: unknown,
): MapMinReviews | 0 {
  return scope === "google" ? parseMapMinReviews(raw) : 0;
}

/**
 * The guest Google Reviews floor cuts GOOGLE HITS ONLY, after Google's
 * response (MESITA-2298 §2, MESITA-2305): a Mesita Selected row is never
 * gated by it, whatever the scope — the listed lane passes through as is.
 */
export function admitGuestMinReviews<T extends ListedMapRow>(
  listed: T[],
  google: NearbyHit[],
  minReviews: number,
): { listed: T[]; google: NearbyHit[] } {
  if (!(minReviews > 0)) return { listed, google };
  return {
    listed,
    google: google.filter((hit) =>
      clearsMinReviews(hit.reviewCount, minReviews)
    ),
  };
}

/** Every guest family. Stored switches do not turn a family off. */
export function enabledMapSupers(_map: MapConfig): SuperParamKey[] {
  return [...SUPER_PARAM_KEYS];
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

/**
 * The Map popularity floor, on the Area pipeline's Popularity: 0..1 against
 * the operator's reference (`params.popularity`). An unrated place scores 0,
 * so any floor above 0 drops it, the same reading as a Google stub.
 */
export function listedClearsMapPopularity(
  place: ListedMapRow,
  map: MapConfig,
  reference?: SignalParams["popularity"],
): boolean {
  if (!(map.minPopularity > 0)) return true;
  const score = popularity(
    {
      rating: place.google_stars_overall ?? null,
      reviewCount: place.google_review_count ?? null,
    },
    {
      rating: reference?.referenceRating ?? POPULARITY_REFERENCE_RATING_DEFAULT,
      reviews: reference?.referenceReviews ??
        POPULARITY_REFERENCE_REVIEWS_DEFAULT,
    },
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
  reference?: SignalParams["popularity"],
): { listed: T[]; google: NearbyHit[] } {
  const admittedListed = listed.filter((row) =>
    listedClearsMapPopularity(row, map, reference)
  );
  const admittedGoogle = google.filter((hit) =>
    googleHitClearsMapFloors(hit, map)
  );
  return { listed: admittedListed, google: admittedGoogle };
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
