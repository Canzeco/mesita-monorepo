// The four Discovery signals (MESITA-2327): continuous scores in [0, 1],
// defined once and reused by the pipelines that name them.
//
//   name_similarity         Name     · the Name pipeline
//   description_similarity  Description · the Deep pipeline
//   proximity               Proximity · the Area pipeline
//   popularity              Popularity · the Area pipeline
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

/**
 * PROVISIONAL, awaiting calibration: the distance at which Proximity scores
 * one half. 4.1 km is where the curve this replaces (logarithmic, Max km 25,
 * knee 1 km, the live values on 2026-10-18) crossed 0.5, kept so the
 * cut-over does not move the midpoint. It is not an empirical finding.
 */
export const PROXIMITY_HALF_DISTANCE_KM_DEFAULT = 4.1;
export const PROXIMITY_HALF_DISTANCE_KM_MIN = 0.1;
export const PROXIMITY_HALF_DISTANCE_KM_MAX = 50;

/**
 * proximity(d) = 2^(−d / halfDistance): 1 at the anchor, 0.5 at
 * halfDistance, 0.25 at twice it, never negative. Raw distance never reaches
 * a score; the radius that decides who is a candidate stays separate. A
 * distance that is not a number cannot be placed, so it scores 0, the same
 * as a place with no coordinates; an infinite one is infinitely far.
 */
export function proximityFromDistance(distanceKm: number, halfDistanceKm: number): number {
  const half = Number.isFinite(halfDistanceKm) && halfDistanceKm > 0
    ? halfDistanceKm
    : PROXIMITY_HALF_DISTANCE_KM_DEFAULT;
  if (Number.isNaN(distanceKm) || distanceKm === Infinity) return 0;
  if (distanceKm <= 0) return 1;
  return clamp01(Math.pow(2, -distanceKm / half));
}

/**
 * Missing data: no anchor (a guest who shared no location) → 1 for every
 * place, the signal abstains instead of inventing a centre. A place with no
 * coordinates → 0: it cannot be placed relative to the anchor at all.
 */
export function proximity(
  candidate: { lat?: number | null; lng?: number | null },
  anchor: { lat: number; lng: number } | null,
  halfDistanceKm: number,
): number {
  if (!anchor) return 1;
  if (typeof candidate.lat !== "number" || typeof candidate.lng !== "number") return 0;
  const km = haversineKm(anchor.lat, anchor.lng, candidate.lat, candidate.lng);
  return Number.isFinite(km) ? proximityFromDistance(km, halfDistanceKm) : 0;
}

// ── Popularity ────────────────────────────────────────────────────────────

/**
 * PROVISIONAL, awaiting calibration: Popularity reaches 1 at this many Google
 * reviews at this rating. The spec's reference is a market p95; on
 * 2026-10-18 only 6 live places carried both numbers, too few for a
 * percentile, so the reference is an explicit, editable anchor instead.
 */
export const POPULARITY_REFERENCE_RATING_DEFAULT = 4.5;
export const POPULARITY_REFERENCE_REVIEWS_DEFAULT = 1000;

/** ln(1 + rating × reviewCount): the raw, unbounded volume-and-quality mass.
 *  A value that is not a finite number counts as 0, never NaN. */
export function rawPopularity(rating: number, reviewCount: number): number {
  const r = Number.isFinite(rating) ? Math.max(0, rating) : 0;
  const n = Number.isFinite(reviewCount) ? Math.max(0, reviewCount) : 0;
  return Math.log1p(r * n);
}

/**
 * popularity = clamp(raw / reference, 0, 1), reference = raw at the anchor,
 * so it multiplies with Proximity on the same 0..1 scale. Missing data: no
 * rating or no review count → 0 — an unrated place sorts last, and there is
 * deliberately no new-place prior.
 */
export function popularity(
  candidate: { rating?: number | null; reviewCount?: number | null },
  reference: { rating: number; reviews: number },
): number {
  const r = candidate.rating;
  const n = candidate.reviewCount;
  if (typeof r !== "number" || typeof n !== "number") return 0;
  if (!Number.isFinite(r) || !Number.isFinite(n)) return 0;
  const ref = rawPopularity(reference.rating, reference.reviews);
  if (!(ref > 0)) return 0;
  return clamp01(rawPopularity(r, n) / ref);
}

// ── Name ──────────────────────────────────────────────────────────────────

/** Diacritics off, lowercase, punctuation to spaces, single spaces. Letters
 *  and digits of every script survive (寿司, Кафе, مقهى), so a name outside
 *  Latin still matches itself. */
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function trigrams(s: string): Map<string, number> {
  const padded = `  ${s} `;
  const out = new Map<string, number>();
  for (let i = 0; i + 3 <= padded.length; i++) {
    const g = padded.slice(i, i + 3);
    out.set(g, (out.get(g) ?? 0) + 1);
  }
  return out;
}

/**
 * The lexical fallback: Dice similarity over character trigrams of the
 * normalized names; an exact normalized match is 1, a name that starts with
 * the query scores at least 0.8 (a typed prefix is a strong hit).
 */
export function lexicalNameSimilarity(query: string, name: string): number {
  const a = normalizeName(query);
  const b = normalizeName(name);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ta = trigrams(a);
  const tb = trigrams(b);
  let shared = 0;
  let total = 0;
  for (const [, n] of ta) total += n;
  for (const [, n] of tb) total += n;
  for (const [g, n] of ta) shared += Math.min(n, tb.get(g) ?? 0);
  const dice = total > 0 ? (2 * shared) / total : 0;
  return b.startsWith(a) ? Math.max(0.8, dice) : clamp01(dice);
}

export type NameSimilarity = { score: number; method: "embedding" | "lexical" };

/**
 * name_similarity. Candidate name embeddings are precomputed; the query is
 * embedded once per request and the cosine runs here, locally. Missing data:
 * no query vector or no candidate vector → the lexical fallback, never a
 * silent 0 (a missing embedding is an enrichment gap, not a mismatch).
 */
export function nameSimilarity(
  query: { text: string; vector: number[] | null },
  candidate: { name?: string | null; nameEmbedding?: unknown },
): NameSimilarity {
  const v = query.vector ? parseVector(candidate.nameEmbedding) : null;
  if (query.vector && v && v.length === query.vector.length) {
    const cos = cosineSim(query.vector, v);
    if (Number.isFinite(cos)) return { score: clamp01(cos), method: "embedding" };
  }
  return {
    score: lexicalNameSimilarity(query.text, String(candidate.name ?? "")),
    method: "lexical",
  };
}

// ── Description ───────────────────────────────────────────────────────────

/**
 * description_similarity: the query's meaning against the place's
 * precomputed summary embedding. Lazy by construction: it takes a vector a
 * pipeline has already chosen to compute, so Area (which does not use it)
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
