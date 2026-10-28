// The Discovery signals (MESITA-2327): continuous scores in [0, 1],
// defined once and reused by the pipelines that name them. name_similarity
// left with the Mesita name vector (MESITA-2896/2900): Google's name is
// canonical.
//
//   description_similarity  Description · the Deep pipeline
//   proximity               Proximity · the Catalog pipeline (and Chat)
//   popularity              Popularity · the Map and Catalog pipelines
//
// A signal scores; it never excludes (that is a gate's job, area-score.ts).
// Each one states its own missing-data policy here, beside the formula, so a
// pipeline cannot quietly give a gap a meaning. Nothing in this file calls a
// network: a query vector arrives already embedded, and only a pipeline that
// uses a vector signal ever asks for one (lazy evaluation).

import { cosineSim, parseVector } from "./embeddings-vector.ts";
import { haversineKm } from "./geo.ts";

const clamp01 = (n: number) => (n <= 0 ? 0 : n >= 1 ? 1 : n);

// ── Proximity ─────────────────────────────────────────────────────────────

/** THE HALF DISTANCE h (km, MESITA-2909): the Catalog pipeline's Proximity
 *  is ½ at h. The operator's number (`params.proximity.halfKm`). 5 km is
 *  Pato's starting point (2026-10-27), to tune on real results. */
export const PROXIMITY_HALF_KM_DEFAULT = 5;
export const PROXIMITY_HALF_KM_MIN = 0.5;
export const PROXIMITY_HALF_KM_MAX = 50;

/**
 * proximity(d) = 1 ÷ (1 + ln(1 + (e − 1) · d ÷ h)), h = the half distance
 * (Pato, MESITA-2909: "que al principio su valor sea muy alto y decaiga muy
 * rápido y cada vez decaiga más lento"): 1 at the point, ½ at h, a steep
 * fall near the guest that flattens with distance, never 0. Only the Catalog
 * pipeline (Home) and Chat read it; the Map ranks by Popularity alone and
 * uses distance only as its screen (MESITA-2909). It replaced the
 * reciprocal 1 ÷ (1 + d ÷ (radius ÷ k)) (MESITA-2706/2720): the Catalog has
 * no radius. A distance that is not a number cannot be placed, so it scores
 * 0; so does any distance past the point when h is not positive.
 */
export function proximityFromDistance(distanceKm: number, halfKm: number): number {
  if (Number.isNaN(distanceKm) || distanceKm === Infinity) return 0;
  if (distanceKm <= 0) return 1;
  if (!(Number.isFinite(halfKm) && halfKm > 0)) return 0;
  return clamp01(1 / (1 + Math.log1p((Math.E - 1) * distanceKm / halfKm)));
}

/**
 * Missing data: no anchor (a guest who shared no location) → 1 for every
 * place, the signal abstains instead of inventing a centre. A place with no
 * coordinates → 0: it cannot be placed relative to the anchor at all.
 */
export function proximity(
  candidate: { lat?: number | null; lng?: number | null },
  anchor: { lat: number; lng: number } | null,
  halfKm: number,
): number {
  if (!anchor) return 1;
  if (typeof candidate.lat !== "number" || typeof candidate.lng !== "number") return 0;
  const km = haversineKm(anchor.lat, anchor.lng, candidate.lat, candidate.lng);
  return Number.isFinite(km) ? proximityFromDistance(km, halfKm) : 0;
}

// ── Popularity ────────────────────────────────────────────────────────────

/**
 * THE MAP AND CATALOG SCORES' POPULARITY (Pato, MESITA-2710: "ln(num of google
 * [reviews] × average of stars) … popularity can be above 1, it must not be
 * normalized"): ln(1 + reviews × stars). Unbounded: 4.6★ × 1,000 reviews ≈
 * 8.43, 4.0★ × 30 ≈ 4.80. The 1 + keeps a place with no reviews at 0, not
 * −∞ (within 1% of ln(reviews × stars) from 10 reviews up). No rating or no
 * review count → 0.
 */
export function logPopularity(
  candidate: { rating?: number | null; reviewCount?: number | null },
): number {
  const r = candidate.rating;
  const n = candidate.reviewCount;
  if (typeof r !== "number" || typeof n !== "number") return 0;
  if (!Number.isFinite(r) || !Number.isFinite(n)) return 0;
  return Math.log1p(Math.max(0, n) * Math.max(0, r));
}

/** True when the place's Popularity is at or over the operator's floor
 *  (`map.popularityFloor`, MESITA-2714); a floor of 0 or less is off. One
 *  reading for the Map and Catalog gate and the guest bar's order (MESITA-2724). */
export function clearsPopularityFloor(
  candidate: { rating?: number | null; reviewCount?: number | null },
  floor: number,
): boolean {
  if (!(floor > 0)) return true;
  return logPopularity(candidate) >= floor;
}

/** The 0..1 Popularity below now feeds only the stored `map.minPopularity`
 *  floor (live 0, no box edits it); the Map and Catalog read `logPopularity`. */

/** Reviews for half credit: Popularity's volume term is ½ at this many
 *  Google reviews. The operator's number (`params.popularity.halfReviews`). */
export const POPULARITY_HALF_REVIEWS_DEFAULT = 100;
export const POPULARITY_HALF_REVIEWS_MIN = 1;
export const POPULARITY_HALF_REVIEWS_MAX = 100_000;

/**
 * popularity = (rating ÷ 5) × reviews ÷ (reviews + halfReviews)
 * (MESITA-2347). Rating counts linearly — a 3★ place is 60% of a 5★ one
 * at any volume — and volume saturates: ½ credit at `halfReviews`, never 1.
 * 0..1 by construction. Missing data: no rating or no review count → 0,
 * and there is deliberately no new-place prior; under the Area score's
 * weighted sum that demotes the place, it never deletes it.
 */
export function popularity(
  candidate: { rating?: number | null; reviewCount?: number | null },
  halfReviews: number,
): number {
  const r = candidate.rating;
  const n = candidate.reviewCount;
  if (typeof r !== "number" || typeof n !== "number") return 0;
  if (!Number.isFinite(r) || !Number.isFinite(n)) return 0;
  const k = Number.isFinite(halfReviews) && halfReviews > 0
    ? halfReviews
    : POPULARITY_HALF_REVIEWS_DEFAULT;
  const rating = clamp01(Math.max(0, r) / 5);
  const count = Math.max(0, n);
  return clamp01(rating * (count / (count + k)));
}

// ── Description ───────────────────────────────────────────────────────────

/**
 * description_similarity: the query's meaning against the place's
 * precomputed summary embedding. Lazy by construction: it takes a vector a
 * pipeline has already chosen to compute, so the Map and Catalog (which do not use it)
 * never triggers an embedding call. Missing data: no candidate vector →
 * null, "cannot judge"; the Deep pipeline leaves such a place out rather
 * than ranking it as a mismatch.
 */
export function descriptionSimilarity(
  queryVector: number[],
  embedding: unknown,
): number | null {
  const v = parseVector(embedding);
  if (!v || v.length !== queryVector.length) return null;
  const cos = cosineSim(queryVector, v);
  return Number.isFinite(cos) ? clamp01(cos) : null;
}
