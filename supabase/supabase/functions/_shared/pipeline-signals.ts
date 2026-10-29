// The Discovery signals (MESITA-2327): continuous scores, defined once and
// reused by the pipelines that name them. name_similarity left with the
// Mesita name vector (MESITA-2896/2900): Google's name is canonical.
//
//   description_similarity  Description · the Deep pipeline
//   proximity               Proximity · the Catalog pipeline (and Chat)
//                           1 ÷ (1 + (d ÷ D)^e), MESITA-3015, MESITA-3083
//   popularity              Popularity · the Map and Catalog pipelines
//                           (1 + reviews × stars)^root, MESITA-3083
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

/** THE HALF DISTANCE D (km, MESITA-3015): the Catalog pipeline's Proximity
 *  is ½ at D, whatever the exponent. The operator's `params.proximity.halfKm`,
 *  0.1–100 km, live 1 km (Pato, 2026-10-29: "e 1 and h as 1 too"). Read it
 *  as the radius of "here", the distance that changes no decision: about
 *  half a kilometre on foot, two or three by car. */
export const PROXIMITY_HALF_KM_DEFAULT = 1;
export const PROXIMITY_HALF_KM_MIN = 0.1;
export const PROXIMITY_HALF_KM_MAX = 100;

/** THE DISTANCE EXPONENT e (MESITA-3083): the operator's
 *  `params.proximity.exponent`, 0.5–4 at one decimal, live 1. At 1 the
 *  curve is the plain reciprocal: past D the credit is D ÷ d, twice as far
 *  is half, and with Popularity's cube root the three factors speak one
 *  language (8× the reviews = a ×2 plan = twice as close). Under 1 the far
 *  keeps its credit (a city-wide fame list); over 1 the curve is flat
 *  inside D and a cliff past it (the far is gone, however great). MESITA-3015
 *  had ruled "never an exponent knob"; Pato reversed it to keep every
 *  hyperparameter functional. */
export const PROXIMITY_EXPONENT_DEFAULT = 1;
export const PROXIMITY_EXPONENT_MIN = 0.5;
export const PROXIMITY_EXPONENT_MAX = 4;

/**
 * proximity(d) = 1 ÷ (1 + (d ÷ D)^e), D the half distance, e the exponent
 * (MESITA-3015, MESITA-3083): 1 at the point, ½ at D whatever e is, never
 * 0. At e = 1: ⅓ at 2D, and past D only distance RATIOS order places, twice
 * as far is half the credit at any scale, so a place wins from twice as far
 * with 8× the reviews (Popularity's cube root) or a ×2 plan, and from five
 * times as far with 125× the reviews or a ×5 plan. Another city (100× the
 * distance) never tops Home; a walking city and a car city rank alike, D
 * being the only city-shaped number. It replaced the log curve
 * 1 ÷ (1 + ln(1 + (e − 1) · d ÷ h)) (MESITA-2909), which kept a famous
 * place 36 km away above an average one 5 km away. Only the Catalog
 * pipeline (Home) and Chat read it; the Map ranks by Popularity alone and
 * uses distance only as its screen (MESITA-2909). A distance that is not a
 * number cannot be placed, so it scores 0; so does any distance past the
 * point when D is not positive. An exponent that is not a positive number
 * reads the default.
 */
export function proximityFromDistance(
  distanceKm: number,
  halfKm: number,
  exponent: number = PROXIMITY_EXPONENT_DEFAULT,
): number {
  if (Number.isNaN(distanceKm) || distanceKm === Infinity) return 0;
  if (distanceKm <= 0) return 1;
  if (!(Number.isFinite(halfKm) && halfKm > 0)) return 0;
  const e = Number.isFinite(exponent) && exponent > 0 ? exponent : PROXIMITY_EXPONENT_DEFAULT;
  return clamp01(1 / (1 + Math.pow(distanceKm / halfKm, e)));
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
  exponent: number = PROXIMITY_EXPONENT_DEFAULT,
): number {
  if (!anchor) return 1;
  if (typeof candidate.lat !== "number" || typeof candidate.lng !== "number") return 0;
  const km = haversineKm(anchor.lat, anchor.lng, candidate.lat, candidate.lng);
  return Number.isFinite(km) ? proximityFromDistance(km, halfKm, exponent) : 0;
}

// ── Popularity ────────────────────────────────────────────────────────────

/** THE POPULARITY ROOT (MESITA-3083): the operator's
 *  `params.popularity.root`, 0.1–1 at two decimals, live 0.33, the cube
 *  root (Pato, 2026-10-29: "POPULARITY IS GOING TO BE CUBIC ROOT"; "the
 *  hyperparameter is which root"). At the cube root every 8× the reviews
 *  doubles the factor and every 1,000× is 10×, so the Premier tiers read
 *  as reviews: ×2 = 8× the reviews, ×5 = 125×. A bigger root makes reviews
 *  count more against a plan; a smaller one less. */
export const POPULARITY_ROOT_DEFAULT = 0.33;
export const POPULARITY_ROOT_MIN = 0.1;
export const POPULARITY_ROOT_MAX = 1;

/**
 * THE MAP AND CATALOG SCORES' POPULARITY: (1 + reviews × stars)^root
 * (MESITA-3083; ln(1 + reviews × stars) from MESITA-2710 until then, whose
 * spread was 1.8× at most, so a ×2 plan beat any popularity gap). Unbounded,
 * never normalized (Pato, MESITA-2710: "popularity can be above 1, it must
 * not be normalized"): at the cube root 4.6★ × 1,000 reviews ≈ 16.2, 4.0★ ×
 * 30 ≈ 4.9. The 1 + keeps a place with no reviews at 1 (a factor, never
 * 0 or −∞): it ranks by distance and plan alone. No rating or no review
 * count → 0. A root that is not a positive number reads the default.
 */
export function rootPopularity(
  candidate: { rating?: number | null; reviewCount?: number | null },
  root: number = POPULARITY_ROOT_DEFAULT,
): number {
  const r = candidate.rating;
  const n = candidate.reviewCount;
  if (typeof r !== "number" || typeof n !== "number") return 0;
  if (!Number.isFinite(r) || !Number.isFinite(n)) return 0;
  const a = Number.isFinite(root) && root > 0 ? root : POPULARITY_ROOT_DEFAULT;
  return Math.pow(1 + Math.max(0, n) * Math.max(0, r), a);
}

/** True when the place's Popularity is at or over the operator's floor
 *  (`name.popularityFloor`, MESITA-2714; `map.popularityFloor` until
 *  MESITA-3086; in the root's own units since MESITA-3083: 2.7 ≈ reviews ×
 *  stars of 19); a floor of 0 or less is off. Read only by the guest
 *  Search bar's order (MESITA-2724): Home, the Map and Chat hide nothing
 *  for Popularity since MESITA-3086. */
export function clearsPopularityFloor(
  candidate: { rating?: number | null; reviewCount?: number | null },
  floor: number,
  root: number = POPULARITY_ROOT_DEFAULT,
): boolean {
  if (!(floor > 0)) return true;
  return rootPopularity(candidate, root) >= floor;
}

/** The 0..1 Popularity below now feeds only the stored `map.minPopularity`
 *  floor (live 0, no box edits it); the Map and Catalog read `rootPopularity`.
 *  Its half point K is a constant since MESITA-3083: the
 *  `params.popularity.halfReviews` knob was stored, mirrored and read by
 *  nothing, so it was retired. */
export const POPULARITY_HALF_REVIEWS_DEFAULT = 100;

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
