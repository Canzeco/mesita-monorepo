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

/** Proximity's reach is the request's own radius (MESITA-2703): 1 at the
 *  point, 0 at the circle's edge, the same on Home and the Map. */

/**
 * proximity(d) = 1 − d ÷ reach (MESITA-2347, reach MESITA-2431): 1 at the
 * anchor, ½ at half the reach, 0 at the reach and beyond, linear between.
 * A distance that is not a number cannot be placed, so it scores 0; a reach
 * that is not positive makes every place score 0 except the anchor itself.
 */
export function proximityFromDistance(distanceKm: number, reachKm: number): number {
  if (Number.isNaN(distanceKm) || distanceKm === Infinity) return 0;
  if (distanceKm <= 0) return 1;
  if (!(Number.isFinite(reachKm) && reachKm > 0)) return 0;
  return clamp01(1 - distanceKm / reachKm);
}

/**
 * Missing data: no anchor (a guest who shared no location) → 1 for every
 * place, the signal abstains instead of inventing a centre. A place with no
 * coordinates → 0: it cannot be placed relative to the anchor at all.
 */
export function proximity(
  candidate: { lat?: number | null; lng?: number | null },
  anchor: { lat: number; lng: number } | null,
  reachKm: number,
): number {
  if (!anchor) return 1;
  if (typeof candidate.lat !== "number" || typeof candidate.lng !== "number") return 0;
  const km = haversineKm(anchor.lat, anchor.lng, candidate.lat, candidate.lng);
  return Number.isFinite(km) ? proximityFromDistance(km, reachKm) : 0;
}

// ── Popularity ────────────────────────────────────────────────────────────

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

// ── Name ──────────────────────────────────────────────────────────────────

/** Latin diacritics off (Café = Cafe), lowercase, punctuation to spaces,
 *  single spaces. Letters, marks and digits of every other script survive
 *  (寿司, Кафе, カフェ ≠ ガフェ), so a name outside Latin still matches itself
 *  and only itself. Spanish ordinals fold (1ª = 1a). */
export function normalizeName(s: string): string {
  return s
    .replace(/ª/g, "a")
    .replace(/º/g, "o")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
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
