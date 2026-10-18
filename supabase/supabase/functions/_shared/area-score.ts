// The Area pipeline's gates and score (MESITA-2327, reshaped by MESITA-2347).
//
//   finalScore = familyGate × selectedGate
//                × (Proximity × Pw + Popularity × Qw) ÷ (Pw + Qw)
//
// Gates are binary eligibility (0 or 1) and stay separate from the
// continuous signals, so diagnostics can say WHY a place is out (a gate)
// apart from why it is low (a signal). The two signals combine as a WEIGHTED
// SUM, so a place missing one number (a Mesita place Google does not count
// yet) is demoted, never zeroed; the weights are the operator's two numbers
// (0..10 each, `params.balance`) and the sum is divided by their total so
// the score stays 0..1 whatever they are. Both weights 0 = every eligible
// place ties and distance alone orders. A place a gate closes is dropped,
// not ranked at 0, so it never sorts behind an eligible one. Ties break on
// distance, then id, so the order is deterministic.

import { popularity, proximity } from "./pipeline-signals.ts";
import { haversineKm } from "./geo.ts";

/** What the guest asked of the Area pipeline. */
export type AreaContext = {
  /** The geographic anchor (device, city, pin, map centre); null = none. */
  anchor: { lat: number; lng: number } | null;
  /** Requested families; empty = no Family gate (every family passes). */
  families: readonly string[];
  /** The Selected gate is active only for the Mesita Selected scope. */
  selectedOnly: boolean;
  /** The radius that made the candidates: Proximity is 0 at its edge. */
  radiusKm: number;
  /** Popularity's volume term is ½ at this many reviews. */
  halfReviews: number;
  /** The operator's two weights, 0..10 each. */
  balance: { proximity: number; popularity: number };
};

/** One candidate, normalized from whichever source produced it. */
export type AreaCandidate = {
  id: string;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  reviewCount: number | null;
  familyKeys: readonly string[];
  /** Mesita Selected: an Enrich run completed and the profile is ready. */
  selected: boolean;
};

/**
 * Family gate: 1 when no family is requested, else 1 iff the candidate
 * belongs to a requested family. Missing/unknown policy: a candidate with no
 * known family (none, or only "undefined") is OUT whenever a family is
 * requested — it cannot be shown to answer the ask. Sources may push the
 * family down into their query (Nearby's primary types, Mesita's
 * family_keys); this gate re-checks so every source obeys the same rule.
 */
export function familyGate(
  candidateFamilies: readonly string[],
  requested: readonly string[],
): 0 | 1 {
  if (requested.length === 0) return 1;
  const known = candidateFamilies.filter((f) => f && f !== "undefined");
  return known.some((f) => requested.includes(f)) ? 1 : 0;
}

/**
 * Selected gate: 1 for every candidate when the scope is Google Places; for
 * the Mesita Selected scope, 1 iff the place is Mesita Selected. An
 * intrinsic stored fact, so unknown is simply not Selected.
 */
export function selectedGate(selected: boolean, selectedOnly: boolean): 0 | 1 {
  return !selectedOnly || selected ? 1 : 0;
}

/** The weighted sum of the two signals, 0..1; 0 when both weights are 0. */
export function weightedArea(
  prox: number,
  pop: number,
  balance: { proximity: number; popularity: number },
): number {
  const pw = Number.isFinite(balance.proximity) ? Math.max(0, balance.proximity) : 0;
  const qw = Number.isFinite(balance.popularity) ? Math.max(0, balance.popularity) : 0;
  const total = pw + qw;
  if (!(total > 0)) return 0;
  return (prox * pw + pop * qw) / total;
}

export type AreaScore = {
  score: number;
  gates: { family: 0 | 1; selected: 0 | 1 };
  proximity: number;
  popularity: number;
  distanceKm: number | null;
};

export function areaScore(c: AreaCandidate, ctx: AreaContext): AreaScore {
  const gates = {
    family: familyGate(c.familyKeys, ctx.families),
    selected: selectedGate(c.selected, ctx.selectedOnly),
  };
  const prox = proximity(c, ctx.anchor, ctx.radiusKm);
  const pop = popularity(c, ctx.halfReviews);
  const km = ctx.anchor && typeof c.lat === "number" && typeof c.lng === "number"
    ? haversineKm(ctx.anchor.lat, ctx.anchor.lng, c.lat, c.lng)
    : null;
  return {
    score: gates.family * gates.selected * weightedArea(prox, pop, ctx.balance),
    gates,
    proximity: prox,
    popularity: pop,
    distanceKm: km !== null && Number.isFinite(km) ? km : null,
  };
}

/**
 * Rank candidates: gate, score, then sort by score, distance and id. Returns
 * each eligible candidate with its diagnostics, best first.
 */
export function rankArea<T>(
  items: readonly T[],
  toCandidate: (item: T) => AreaCandidate,
  ctx: AreaContext,
): Array<{ item: T; area: AreaScore }> {
  return items
    .map((item) => ({ item, candidate: toCandidate(item) }))
    .map(({ item, candidate }) => ({ item, id: candidate.id, area: areaScore(candidate, ctx) }))
    .filter(({ area }) => area.gates.family === 1 && area.gates.selected === 1)
    .sort((a, b) =>
      b.area.score - a.area.score ||
      (a.area.distanceKm ?? Infinity) - (b.area.distanceKm ?? Infinity) ||
      a.id.localeCompare(b.id)
    )
    .map(({ item, area }) => ({ item, area }));
}
