// The Area pipeline's gates and its two signals (MESITA-2327; one pool
// since MESITA-2379; points only since Territory was retired, MESITA-2500,
// MESITA-2603; two signals since MESITA-2703; the Selected boost since
// MESITA-2717).
//
//   point location   final = Proximity × Popularity × s
//   no location      final = Popularity × s
//
// No exponents since MESITA-2722 (Pato: "kinda redundant factors"): the
// product's order only ever read a : b, and the radius divisor already
// says how much distance costs; `map.proximityWeight` and
// `map.popularityWeight` (MESITA-2703, both 1) are retired.
// Proximity is 1 ÷ (1 + distance ÷ H), H = radius ÷ k,
// k the operator's radius divisor (MESITA-2720; a fixed H, MESITA-2706,
// before): 1 at the point, ½ at H, 1 ÷ (1 + k) at the edge whatever the
// radius, never 0; the Radius gate alone decides who is in. Popularity is ln(1 + reviews × stars), unbounded, and the product is
// never clamped or normalized (MESITA-2710). s is the operator's Selected
// boost (`map.selectedFactor`, default 3; "Selected factor" until MESITA-2722) for a Mesita Selected place and
// 1 for every other place (Pato, MESITA-2717: "not select is 1, select is
// 3"). Selected was a third signal (MESITA-2439) until MESITA-2703; it is
// back as a plain multiplier, never an exponent.
//
// Gates are binary eligibility (0 or 1) and stay separate from the
// continuous signals, so diagnostics can say WHY a place is out (a gate)
// apart from why it is low (a signal). A place a gate closes is dropped, not
// ranked at 0. Gates: Family (every location) and Radius (a point: inside
// the circle). Ties break on distance (a point only), then id.

import { clearsPopularityFloor, halfDistanceKm, logPopularity, proximity } from "./pipeline-signals.ts";
import { haversineKm } from "./geo.ts";

/** Where a candidate's card comes from. `selected` = Mesita Selected, the
 *  operator's mark on the row (`places.selected`, MESITA-2707; independent
 *  of Enriched); `mesita` = a ready Mesita row without the mark; `google` =
 *  a Google-only stub. `selected` alone takes the Selected boost
 *  (MESITA-2717); the other two score × 1. */
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
  /** Proximity is ½ at the location's radius ÷ this (MESITA-2720): the
   *  operator's `params.proximity.radiusDivisor`. */
  radiusDivisor: number;
  /** The Popularity floor (MESITA-2714): a place whose Popularity is under
   *  it is dropped, whatever its source; 0 or absent = off. */
  popularityFloor?: number;
  /** The Selected boost (MESITA-2717): a `selected` candidate's score is
   *  multiplied by it; absent = 1. */
  selectedFactor?: number;
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
  /** Spotlight (MESITA-1998): the paid tier, `places.spotlight_tier`
   *  (0 · 1 · 2); absent = 0. */
  spotlightTier?: number;
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

/** A signal as a factor (MESITA-2710: "don't try to normalize … it's just
 *  a clean multiplication"): never clamped above, so Popularity past 1
 *  keeps its size; a negative or non-finite signal reads 0. */
function factor(x: number): number {
  return Number.isFinite(x) ? Math.max(0, x) : 0;
}

/** The factor a candidate's score is multiplied by (MESITA-2717): the
 *  operator's Selected boost for a Mesita Selected place, 1 for every other
 *  place. A missing, non-finite or non-positive factor reads 1.
 *
 *  Spotlight (MESITA-1998, Pato: the paid tier "cambia qué tanto aparece"):
 *  a Spotlight place takes the same boost, a Spotlight Plus place the boost
 *  squared. A place that is both Selected and Spotlighted takes the larger,
 *  never the product: paying never stacks on the operator's mark.
 *  decision: Spotlight reuses `map.selectedFactor` rather than a new knob,
 *  so the operator keeps one dial for "how much a boost is worth". */
export function selectedFactor(
  c: Pick<AreaCandidate, "source" | "spotlightTier">,
  ctx: Pick<AreaContext, "selectedFactor">,
): number {
  const raw = ctx.selectedFactor;
  const s = typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : 1;
  const selected = c.source === "selected" ? s : 1;
  const tier = c.source === "google" ? 0 : c.spotlightTier ?? 0;
  const spotlight = tier >= 2 ? s * s : tier >= 1 ? s : 1;
  return Math.max(selected, spotlight);
}

/** Popularity, or null when the place has no rating or no review count. */
function popularityOrNull(c: AreaCandidate): number | null {
  const ok = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  if (!ok(c.rating) || !ok(c.reviewCount)) return null;
  return logPopularity(c);
}

/** The score without Proximity: Popularity × the Selected boost. The
 *  whole score with no location, and what Mesita Popularity picks by, so the
 *  pick and the ranking agree (MESITA-2717). */
export function popularPart(
  c: AreaCandidate,
  ctx: Pick<AreaContext, "selectedFactor">,
): number {
  return factor(popularityOrNull(c) ?? 0) * selectedFactor(c, ctx);
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
    /** Popularity at or over the operator's floor (MESITA-2714); null when
     *  the floor is off. */
    popularity: 0 | 1 | null;
  };
  signals: { proximity: number | null; popularity: number | null };
  source: AreaSource;
  /** The factor `final` carries (MESITA-2717): the Selected boost for a
   *  Mesita Selected place, else 1. */
  selectedFactor: number;
  /** Proximity × Popularity × selectedFactor. */
  final: number;
  formula: "point" | "none";
};

export type AreaScore = AreaDiagnostics & { distanceKm: number | null };

export function areaScore(c: AreaCandidate, ctx: AreaContext): AreaScore {
  const loc = ctx.location;
  const pop = popularityOrNull(c);
  let km: number | null = null;
  if (loc.kind === "point" && typeof c.lat === "number" && typeof c.lng === "number") {
    const d = haversineKm(loc.anchor.lat, loc.anchor.lng, c.lat, c.lng);
    km = Number.isFinite(d) ? d : null;
  }
  const family = familyGate(c.familyKeys, ctx.families);
  const radius = loc.kind === "point"
    ? (km !== null && km <= loc.radiusKm ? 1 : 0)
    : null;
  const prox = loc.kind === "point"
    ? proximity(c, loc.anchor, halfDistanceKm(loc.radiusKm, ctx.radiusDivisor))
    : null;
  const sel = selectedFactor(c, ctx);
  const popPart = popularPart(c, ctx);
  const final = loc.kind === "point" ? factor(prox ?? 0) * popPart : popPart;
  // THE POPULARITY SCREEN (Pato, MESITA-2714: "if popularity score is
  // below 3 you cannot be shown … it doesn't matter what"): Google or
  // Mesita, Selected or not; no Google numbers reads 0, so it is out too.
  const floor = typeof ctx.popularityFloor === "number" && ctx.popularityFloor > 0
    ? ctx.popularityFloor
    : null;
  const popularityGate = floor === null ? null : clearsPopularityFloor(c, floor) ? 1 : 0;
  const open = family === 1 && radius !== 0 && popularityGate !== 0;
  return {
    familyKeys: knownFamilies(c.familyKeys),
    gates: {
      family,
      radius,
      active: 1,
      ready: c.ready ?? null,
      reviews: c.reviews ?? null,
      popularity: popularityGate,
    },
    signals: { proximity: prox, popularity: pop },
    source: c.source,
    selectedFactor: sel,
    final: open ? final : 0,
    formula: loc.kind,
    distanceKm: km,
  };
}

/** Every gate open: Family, Radius when there is a point, and the
 *  Popularity floor when it is on. */
export function areaGatesOpen(a: AreaDiagnostics): boolean {
  return a.gates.family === 1 && a.gates.radius !== 0 && a.gates.popularity !== 0;
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
