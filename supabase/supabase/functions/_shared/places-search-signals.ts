// Mesita Places search signals (MESITA-2201).
//
// Six functions. Name, proximity, and popularity are numbers. Family and
// Enriched are gates. Randomness does not score a place: after the sort it
// may swap the top tile with the next one, and the bottom tile with the one
// above it. The middle of the list never rolls.
//
// This is not the Discovery blend. Swipe, map, and catalog still multiply
// signals in [0, 1]. This lane adds three 0-to-10 terms.

/** Name. Cosine similarity, kept on −1..1. Unit vectors, so the dot product is the cosine. */
export function nameSignal(cosine: number): number {
  if (!Number.isFinite(cosine)) return -1;
  return Math.min(1, Math.max(-1, cosine));
}

/**
 * Family gate. 1 when the place sits in a family the guest asked for.
 * 0 when it sits in none of them. No family asked leaves the gate open.
 */
export function familySignal(
  familyKeys: readonly string[] | null | undefined,
  asked: readonly string[] | null | undefined,
): number {
  const want = (asked ?? []).filter((f) => f.length > 0);
  if (want.length === 0) return 1;
  const have = familyKeys ?? [];
  return want.some((f) => have.includes(f)) ? 1 : 0;
}

/** Distance at which proximity hits 0. */
export const PROXIMITY_MAX_KM = 25;

/**
 * Proximity. Natural log of closeness, on 0..10.
 * 0 km → 10. 25 km and farther → 0.
 * y = 10 · ln(26 / (1 + km)) / ln(26)
 */
export function proximitySignal(km: number): number {
  const d = Math.max(0, km);
  if (d >= PROXIMITY_MAX_KM) return 0;
  const span = Math.log(1 + PROXIMITY_MAX_KM);
  return (10 * Math.log((1 + PROXIMITY_MAX_KM) / (1 + d))) / span;
}

/** Enriched gate. 1 when an Enrich run finished. 0 drops the place. No ladder. */
export function enrichedSignal(done: boolean): number {
  return done ? 1 : 0;
}

/**
 * Popularity. Natural log of stars × review count, capped at 10.
 * ln(22026) = 10. A product of 1 or less is 0 (the log would be negative
 * or undefined). Missing stars or reviews are 0.
 */
export function popularitySignal(
  stars: number | null | undefined,
  reviews: number | null | undefined,
): number {
  if (typeof stars !== "number" || typeof reviews !== "number") return 0;
  if (!Number.isFinite(stars) || !Number.isFinite(reviews)) return 0;
  const evidence = stars * reviews;
  if (!(evidence > 1)) return 0;
  return Math.min(10, Math.log(evidence));
}

/**
 * How wide a rank gap has to be before a tile almost never flips.
 * A tie is 50/50. A gap of a few points barely moves.
 */
export const TILE_TAU = 0.75;

/** P(the neighbor takes the tile) = 1 / (1 + e^(gap / 0.75)). */
export function tileFlipProbability(gap: number): number {
  if (!Number.isFinite(gap)) return 0;
  return 1 / (1 + Math.exp(gap / TILE_TAU));
}

export type PlacesSearchFacts = {
  cosine: number;
  familyKeys?: readonly string[] | null;
  /** Kilometres from the guest. Null when the place has no coordinates. */
  km: number | null;
  enriched: boolean;
  stars: number | null;
  reviews: number | null;
};

export type PlacesSearchIntent = {
  families?: readonly string[] | null;
  /** False → proximity adds 0 for every place. Absence of a guest pin is not evidence. */
  hasGuestGeo: boolean;
};

/**
 * Deterministic rank among places that pass both gates.
 * Name is stretched onto 0..10 so it can be added to the two logs.
 * Returns null when Family or Enriched shuts the gate.
 */
export function placesSearchRank(
  facts: PlacesSearchFacts,
  intent: PlacesSearchIntent,
): number | null {
  if (familySignal(facts.familyKeys, intent.families) === 0) return null;
  if (enrichedSignal(facts.enriched) === 0) return null;
  const name = 5 * (nameSignal(facts.cosine) + 1);
  const prox = intent.hasGuestGeo && typeof facts.km === "number"
    ? proximitySignal(facts.km)
    : 0;
  return name + prox + popularitySignal(facts.stars, facts.reviews);
}

type Scored<T> = { row: T; index: number; rank: number };

/**
 * Swap the top tile with the next place, and the bottom tile with the one
 * above it, each on its own coin. The pairs have to be disjoint, so a list
 * shorter than 4 only rolls the top. `random` returns [0, 1).
 */
export function applyTileRandomness<T>(
  ranked: readonly Scored<T>[],
  random: () => number,
): Scored<T>[] {
  const out = ranked.slice();
  const n = out.length;
  if (n >= 2) {
    const gap = out[0].rank - out[1].rank;
    if (random() < tileFlipProbability(gap)) {
      const top = out[0];
      out[0] = out[1];
      out[1] = top;
    }
  }
  if (n >= 4) {
    const last = n - 1;
    const prev = last - 1;
    const gap = out[prev].rank - out[last].rank;
    if (random() < tileFlipProbability(gap)) {
      const above = out[prev];
      out[prev] = out[last];
      out[last] = above;
    }
  }
  return out;
}

/**
 * Score, drop the gated-out rows, sort best first, then the two tile coins.
 * Ties keep incoming order. `random` defaults to Math.random; tests pass a constant.
 */
export function rankPlacesSearch<T>(
  rows: readonly T[],
  project: (row: T) => PlacesSearchFacts,
  intent: PlacesSearchIntent,
  random: () => number = Math.random,
): T[] {
  const scored: Scored<T>[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rank = placesSearchRank(project(row), intent);
    if (rank == null || !Number.isFinite(rank)) continue;
    scored.push({ row, index, rank });
  }
  scored.sort((a, b) => b.rank - a.rank || a.index - b.index);
  return applyTileRandomness(scored, random).map((s) => s.row);
}
