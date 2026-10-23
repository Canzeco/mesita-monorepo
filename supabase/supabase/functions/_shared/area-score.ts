// The Area pipeline's gates and its two signals (MESITA-2327; one pool
// since MESITA-2379; points only since Territory was retired, MESITA-2500,
// MESITA-2603; two signals since MESITA-2703).
//
//   point location   final = Proximity^a × Popularity^b
//   no location      final = Popularity^b
//
// a = `map.proximityWeight`, b = `map.popularityWeight`, both the operator's
// (Pato, MESITA-2703: "sort them based on the two weights of proximity and
// popularity"). Geometric weights, so only the ratio a : b changes the
// order; 0 turns a signal off (x^0 = 1, an edge place with a = 0 scores
// Popularity^b alone). Proximity is 1 ÷ (1 + distance ÷ halfKm): 1 at the
// point, ½ at the operator's distance for half credit, never 0, the same
// whatever the radius (MESITA-2706); the Radius gate alone decides who is
// in. Selected was a third signal (MESITA-2439) and left the score with
// MESITA-2703; `source` still says where a card comes from.
//
// Gates are binary eligibility (0 or 1) and stay separate from the
// continuous signals, so diagnostics can say WHY a place is out (a gate)
// apart from why it is low (a signal). A place a gate closes is dropped, not
// ranked at 0. Gates: Family (every location) and Radius (a point: inside
// the circle). Ties break on distance (a point only), then id.

import { popularity, proximity } from "./pipeline-signals.ts";
import { haversineKm } from "./geo.ts";

/** Where a candidate's card comes from. `selected` = Mesita Selected, the
 *  operator's mark on the row (`places.selected`, MESITA-2707; independent
 *  of Enriched); `mesita` = a ready Mesita row without the mark; `google` =
 *  a Google-only stub. Provenance only: it never scores (MESITA-2703). */
export type AreaSource = "selected" | "mesita" | "google";

export type LatLng = { lat: number; lng: number };
/** A rectangle: the Map's visible box, read only to measure the screen
 *  radius (MESITA-2511). Never a location: no view searches a rectangle. */
export type AreaBounds = { low: LatLng; high: LatLng };

/** Where the guest asked from: a point (Proximity, inside the Radius), or
 *  nowhere (Popularity alone). Saved areas died with Territory (MESITA-2500). */
export type AreaLocation =
  | { kind: "point"; anchor: LatLng; radiusKm: number }
  | { kind: "none" };

/** What the guest asked of the Area pipeline. */
export type AreaContext = {
  location: AreaLocation;
  /** Requested families; empty = no Family gate (every family passes). */
  families: readonly string[];
  /** Popularity's volume term is ½ at this many reviews. */
  halfReviews: number;
  /** Proximity is ½ at this distance (km): the operator's
   *  `params.proximity.halfKm`, fixed apart from the radius (MESITA-2706). */
  halfKm: number;
  /** The two exponents. */
  weights: AreaWeights;
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

/** True iff the point sits inside the rectangle, edges included: the screen
 *  radius's "is the cross on screen" check. Geometry, not a gate. */
export function insideBounds(
  c: { lat: number | null; lng: number | null },
  bounds: AreaBounds,
): boolean {
  if (typeof c.lat !== "number" || typeof c.lng !== "number") return false;
  if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return false;
  return c.lat >= bounds.low.lat && c.lat <= bounds.high.lat &&
    inLng(c.lng, bounds.low.lng, bounds.high.lng);
}

/** The two exponents (MESITA-2703). */
export type AreaWeights = { proximity: number; popularity: number };

/** x^w with the guards: a missing or negative exponent is 0 (the signal is
 *  off), and 0^0 is 1. */
function weighted(x: number, w: number): number {
  const e = Number.isFinite(w) ? Math.max(0, w) : 0;
  if (e === 0) return 1;
  return Math.pow(Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0)), e);
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
    radius: 0 | 1 | null;
    active: 1;
    ready: 1 | null;
    reviews: 1 | null;
  };
  signals: { proximity: number | null; popularity: number | null };
  source: AreaSource;
  weights: AreaWeights;
  /** Proximity^a × Popularity^b. */
  final: number;
  formula: "point" | "none";
};

export type AreaScore = AreaDiagnostics & { distanceKm: number | null };

export function areaScore(c: AreaCandidate, ctx: AreaContext): AreaScore {
  const loc = ctx.location;
  const pop = popularityOrNull(c, ctx.halfReviews);
  let km: number | null = null;
  if (loc.kind === "point" && typeof c.lat === "number" && typeof c.lng === "number") {
    const d = haversineKm(loc.anchor.lat, loc.anchor.lng, c.lat, c.lng);
    km = Number.isFinite(d) ? d : null;
  }
  const family = familyGate(c.familyKeys, ctx.families);
  const radius = loc.kind === "point"
    ? (km !== null && km <= loc.radiusKm ? 1 : 0)
    : null;
  const prox = loc.kind === "point" ? proximity(c, loc.anchor, ctx.halfKm) : null;
  const w = ctx.weights;
  const popPart = weighted(pop ?? 0, w.popularity);
  const final = loc.kind === "point" ? weighted(prox ?? 0, w.proximity) * popPart : popPart;
  const open = family === 1 && radius !== 0;
  return {
    familyKeys: knownFamilies(c.familyKeys),
    gates: {
      family,
      radius,
      active: 1,
      ready: c.ready ?? null,
      reviews: c.reviews ?? null,
    },
    signals: { proximity: prox, popularity: pop },
    source: c.source,
    weights: { proximity: w.proximity, popularity: w.popularity },
    final: open ? final : 0,
    formula: loc.kind,
    distanceKm: km,
  };
}

/** Every gate open: Family, and Radius when there is a point. */
export function areaGatesOpen(a: AreaDiagnostics): boolean {
  return a.gates.family === 1 && a.gates.radius !== 0;
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
