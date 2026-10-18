// The Area pipeline's gates, signals and Selected factor (MESITA-2327,
// weighted sum since MESITA-2347, one pool since MESITA-2379).
//
//   point location   final = (Proximity × Pw + Popularity × Qw) ÷ (Pw + Qw) × selected
//   area location    final = territory × Popularity × selected
//   no location      final = Popularity × selected
//
// Gates are binary eligibility (0 or 1) and stay separate from the
// continuous signals, so diagnostics can say WHY a place is out (a gate)
// apart from why it is low (a signal). A place a gate closes is dropped, not
// ranked at 0. Gates: Family (every location), Radius (a point: inside the
// operator's circle), Territory (an area: inside its bounds). `Territory` is
// a backend word only; the guest never reads it.
//
// Selected is a FACTOR, not a gate (Pato, 2026-10-18): a Mesita Selected
// place (an Enrich run completed and the profile is ready — curation, never
// payment) keeps its score, every other candidate keeps 0.3 of it. Fixed
// constants, so a strong Google-only place can still outrank a weak Selected
// one. Ties break on distance (a point only), then id.

import { popularity, proximity } from "./pipeline-signals.ts";
import { haversineKm } from "./geo.ts";

/** The Selected factor (MESITA-2379): one place to change it. */
export const SELECTED_FACTOR = { selected: 1, other: 0.3 } as const;

/** Where a candidate's card comes from. `selected` = Mesita Selected;
 *  `mesita` = a ready Mesita row an Enrich run has not completed; `google`
 *  = a Google-only stub. */
export type AreaSource = "selected" | "mesita" | "google";

export function selectedFactor(source: AreaSource): 1 | 0.3 {
  return source === "selected" ? SELECTED_FACTOR.selected : SELECTED_FACTOR.other;
}

export type LatLng = { lat: number; lng: number };
/** A rectangle: Google's viewport for a city, a neighbourhood, a postcode. */
export type AreaBounds = { low: LatLng; high: LatLng };

/** Where the guest asked from: a point (Proximity), an area (Territory), or
 *  nowhere (Popularity alone). Never both for one location. */
export type AreaLocation =
  | { kind: "point"; anchor: LatLng; radiusKm: number }
  | { kind: "area"; bounds: AreaBounds }
  | { kind: "none" };

/** What the guest asked of the Area pipeline. */
export type AreaContext = {
  location: AreaLocation;
  /** Requested families; empty = no Family gate (every family passes). */
  families: readonly string[];
  /** Popularity's volume term is ½ at this many reviews. */
  halfReviews: number;
  /** The operator's two weights, 0..10 each (point locations). */
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
  source: AreaSource;
  /** Operational gates the source already applied: 1 passed, null not
   *  applicable (`ready` for a Google stub, `reviews` for a Mesita row with
   *  no Google hit). Carried into the diagnostics, never re-judged here. */
  ready?: 1 | null;
  reviews?: 1 | null;
};

/**
 * Family gate: a candidate with no guest family (none, or only "undefined")
 * is always OUT (MESITA-2382). Many Google categories sit in no family — a
 * mechanic, a church, a hotel — and they are not Mesita places with or
 * without a pill. With no family requested, any guest family passes; with
 * one, the candidate must belong to a requested family. Sources may push the
 * family down into their query (Nearby's primary types and exclusions,
 * Mesita's family_keys); this gate re-checks so every source obeys the rule.
 */
export function familyGate(
  candidateFamilies: readonly string[],
  requested: readonly string[],
): 0 | 1 {
  const known = knownFamilies(candidateFamilies);
  if (known.length === 0) return 0;
  if (requested.length === 0) return 1;
  return known.some((f) => requested.includes(f)) ? 1 : 0;
}

export function knownFamilies(families: readonly string[]): string[] {
  return families.filter((f) => typeof f === "string" && f && f !== "undefined");
}

/** True when the rectangle wraps the antimeridian (low.lng > high.lng). */
function inLng(lng: number, low: number, high: number): boolean {
  return low <= high ? lng >= low && lng <= high : lng >= low || lng <= high;
}

/** Territory gate: 1 iff the place sits inside the bounds. */
export function territoryGate(
  c: { lat: number | null; lng: number | null },
  bounds: AreaBounds,
): 0 | 1 {
  if (typeof c.lat !== "number" || typeof c.lng !== "number") return 0;
  if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return 0;
  return c.lat >= bounds.low.lat && c.lat <= bounds.high.lat &&
      inLng(c.lng, bounds.low.lng, bounds.high.lng)
    ? 1
    : 0;
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

/** Popularity, or null when the place has no rating or no review count. */
function popularityOrNull(c: AreaCandidate, halfReviews: number): number | null {
  const ok = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  if (!ok(c.rating) || !ok(c.reviewCount)) return null;
  return popularity(c, halfReviews);
}

/** One candidate's Area breakdown — the wire's `area` object (MESITA-2379).
 *  `null` is "n/a", never 0. */
export type AreaDiagnostics = {
  /** The families the Family gate read. */
  familyKeys: string[];
  gates: {
    family: 0 | 1;
    territory: 0 | 1 | null;
    radius: 0 | 1 | null;
    active: 1;
    ready: 1 | null;
    reviews: 1 | null;
  };
  signals: { proximity: number | null; popularity: number | null };
  selected: 1 | 0.3;
  source: AreaSource;
  base: number;
  final: number;
  formula: "point" | "area" | "none";
};

export type AreaScore = AreaDiagnostics & { distanceKm: number | null };

export function areaScore(c: AreaCandidate, ctx: AreaContext): AreaScore {
  const loc = ctx.location;
  const pop = popularityOrNull(c, ctx.halfReviews);
  const popN = pop ?? 0;
  let km: number | null = null;
  if (loc.kind === "point" && typeof c.lat === "number" && typeof c.lng === "number") {
    const d = haversineKm(loc.anchor.lat, loc.anchor.lng, c.lat, c.lng);
    km = Number.isFinite(d) ? d : null;
  }
  const family = familyGate(c.familyKeys, ctx.families);
  const radius = loc.kind === "point"
    ? (km !== null && km <= loc.radiusKm ? 1 : 0)
    : null;
  const territory = loc.kind === "area" ? territoryGate(c, loc.bounds) : null;
  const prox = loc.kind === "point" ? proximity(c, loc.anchor, loc.radiusKm) : null;
  const base = loc.kind === "point"
    ? weightedArea(prox ?? 0, popN, ctx.balance)
    : loc.kind === "area"
    ? (territory ?? 0) * popN
    : popN;
  const factor = selectedFactor(c.source);
  const open = family === 1 && radius !== 0 && territory !== 0;
  return {
    familyKeys: knownFamilies(c.familyKeys),
    gates: {
      family,
      territory,
      radius,
      active: 1,
      ready: c.ready ?? null,
      reviews: c.reviews ?? null,
    },
    signals: { proximity: prox, popularity: pop },
    selected: factor,
    source: c.source,
    base: open ? base : 0,
    final: open ? base * factor : 0,
    formula: loc.kind,
    distanceKm: km,
  };
}

/** Every gate open: Family, and Radius or Territory when they apply. */
export function areaGatesOpen(a: AreaDiagnostics): boolean {
  return a.gates.family === 1 && a.gates.radius !== 0 && a.gates.territory !== 0;
}

/**
 * Rank candidates: gate, score, then sort by final score, distance (a point
 * location) and id. Returns each eligible candidate with its breakdown, best
 * first.
 */
export function rankArea<T>(
  items: readonly T[],
  toCandidate: (item: T) => AreaCandidate,
  ctx: AreaContext,
): Array<{ item: T; area: AreaScore }> {
  return items
    .map((item) => ({ item, candidate: toCandidate(item) }))
    .map(({ item, candidate }) => ({ item, id: candidate.id, area: areaScore(candidate, ctx) }))
    .filter(({ area }) => areaGatesOpen(area))
    .sort((a, b) =>
      b.area.final - a.area.final ||
      (a.area.distanceKm ?? Infinity) - (b.area.distanceKm ?? Infinity) ||
      a.id.localeCompare(b.id)
    )
    .map(({ item, area }) => ({ item, area }));
}
