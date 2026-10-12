// DISCOVERY FILTERS — what may ENTER the pool (MESITA-1276).
//
// A SIGNAL DEMOTES. A FILTER EXCLUDES. That one line is why both boxes exist
// on the Discovery page and why a knob belongs to exactly one of them: a
// signal can only ever reorder places a filter already admitted, and a filter
// cannot express "worse, but still worth showing". Putting a quality floor in
// both is how a weak place gets deleted twice and an operator loses the
// ability to say which they meant.
//
// THESE ARE NOT THE TORN-DOWN FILTER SURFACE. MESITA-1183 deleted a
// GUEST-facing one — what a guest may exclude — and that tombstone stands.
// These are OPERATOR pool policy: catalog-wide admission rules a guest never
// sees, cannot express, and cannot override.
//
// EVERY FILTER IS A QUERY PREDICATE. The pool is capped (POOL_CAP) before
// anything ranks, so a filter applied after the fetch does not narrow the
// catalog — it thins the deck the guest actually receives. Push it into the
// WHERE clause or leave it out of this module.
//
// The one honest exception is the exact-distance trim, and it is marked as
// such below.

import { haversineKm, radiusBoundingBox } from "./geo.ts";
import type { DiscoveryFilters } from "./discovery-config.ts";

/** The subset of a PostgREST builder we use. Kept structural so it is testable. */
export type FilterableQuery<T> = {
  eq: (col: string, val: unknown) => T;
  gte: (col: string, val: unknown) => T;
  lte: (col: string, val: unknown) => T;
};

/**
 * The builder `applyDiscoveryFilters` needs: the three comparisons plus
 * `not`, for the Enriched gate's `enriched_at IS NOT NULL`. A separate type
 * so the General gate's structural builder keeps its three methods.
 */
export type DiscoveryFilterQuery<T> = FilterableQuery<T> & {
  not: (col: string, op: string, val: unknown) => T;
};

/** Where the guest is, when they told us. Both halves or neither. */
export type GeoIntent = { lat: number | null; lng: number | null };

/**
 * Push every enabled filter into the query.
 *
 * `minRating` / `minReviews` use `gte`, which EXCLUDES NULLS. That is the
 * intended reading — a floor asks a place to prove it clears the bar, and a
 * place with no rating has not — but it is worth stating, because in a young
 * catalog most places are unrated and a floor of 3.0 can empty the deck. The
 * console says so beside the field.
 *
 * `maxDistanceKm` becomes a BOUNDING BOX here, not a circle: a real radius
 * needs PostGIS or a lat/lng expression PostgREST cannot express. The box
 * over-selects the corners by ~27%, and `trimToRadius` below removes them.
 */
export function applyDiscoveryFilters<T extends DiscoveryFilterQuery<T>>(
  query: T,
  filters: DiscoveryFilters,
  geo: GeoIntent,
): T {
  let q = query;

  if (filters.requireReady) {
    // The Enriched gate (MESITA-2154) is TWO facts, both required:
    //   `enriched_at IS NOT NULL` — an Enrich run completed, the same fact
    //     `isPlaceEnriched` reads everywhere else. `content_state = 'ready'`
    //     alone (MESITA-1228) admitted every freshly Created place, because
    //     Create saves 'ready' too.
    //   `content_state = 'ready'` — the profile can be shown NOW. Without it
    //     an Enriched place mid re-enrich ('generating', including the
    //     wrong-number refetch a reservation outcome fires) or after a failed
    //     re-enrich ('failed', which nothing clears on its own; the stamp
    //     survives it) walks into Swipe, Scroll, Catalog and the Mesita ring
    //     wearing a Reserve button that consumer-web-create-reservation then
    //     409s as `profile_not_ready`.
    // The stored key keeps its old name on purpose: renaming a persisted key
    // resets the operator's value to the default. The 0–8 Crenup high-water
    // cannot do this job: it is a read-time fold over an event log, not a
    // column.
    q = q.not("enriched_at", "is", null).eq("content_state", "ready");
  }

  if (filters.minRating > 0) {
    q = q.gte("google_stars_overall", filters.minRating);
  }

  if (filters.minReviews > 0) {
    q = q.gte("google_review_count", filters.minReviews);
  }

  if (filters.maxDistanceKm > 0 && typeof geo.lat === "number" && typeof geo.lng === "number") {
    const { latDelta, lngDelta } = radiusBoundingBox(geo.lat, filters.maxDistanceKm);
    q = q
      .gte("lat", geo.lat - latDelta)
      .lte("lat", geo.lat + latDelta)
      .gte("lng", geo.lng - lngDelta)
      .lte("lng", geo.lng + lngDelta);
  }

  return q;
}

/**
 * The corner trim — the one post-fetch step, and only ever a REFINEMENT of the
 * bounding box the query already applied.
 *
 * It can only remove rows the box admitted that fall outside the true circle,
 * so it never reaches past what the predicate already narrowed. Skipping it
 * would serve places up to ~41% beyond the stated radius at the diagonals,
 * which makes the number on the console a lie.
 *
 * A row with no geo is KEPT: an unlocated place was never excluded by the box
 * either (the predicate drops nulls, so it will not be here at all when the
 * filter is on) — this guard only matters when the caller passes rows in
 * without having run the predicate, and dropping them silently would be worse
 * than the alternative.
 */
export function trimToRadius<R>(
  rows: R[],
  latOf: (row: R) => number | null,
  lngOf: (row: R) => number | null,
  maxDistanceKm: number,
  geo: GeoIntent,
): R[] {
  if (maxDistanceKm <= 0) return rows;
  if (typeof geo.lat !== "number" || typeof geo.lng !== "number") return rows;
  return rows.filter((r) => {
    const lat = latOf(r);
    const lng = lngOf(r);
    if (typeof lat !== "number" || typeof lng !== "number") return true;
    return haversineKm(geo.lat as number, geo.lng as number, lat, lng) <= maxDistanceKm;
  });
}
