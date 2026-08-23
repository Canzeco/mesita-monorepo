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
export function applyDiscoveryFilters<T extends FilterableQuery<T>>(
  query: T,
  filters: DiscoveryFilters,
  geo: GeoIntent,
): T {
  let q = query;

  if (filters.requireReady) {
    // The enrichment gate (MESITA-1228). `content_status` is the lifecycle
    // column and only the contents stage lands 'ready', so it answers "the
    // pipeline finished" and separates done from failed. The 0–9 pulse ordinal
    // cannot do this job: it is a read-time fold over an event log, not a
    // column, so it cannot appear in a WHERE clause until MESITA-1249
    // materializes it.
    q = q.eq("content_status", "ready");
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

/** True when any filter is doing work — the console renders this as a summary. */
export function anyFilterActive(f: DiscoveryFilters): boolean {
  return f.requireReady || f.minRating > 0 || f.minReviews > 0 || f.maxDistanceKm > 0;
}
