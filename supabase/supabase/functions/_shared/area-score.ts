// The Area pipeline's gates and its three signals (MESITA-2327; one pool
// since MESITA-2379; the weights table since MESITA-2428; Selected its own
// signal since MESITA-2439).
//
//   point location   final = Proximity^a × Popularity^b × Selected^c
//   area location    final = territory × Popularity^b × Selected^c
//   no location      final = Popularity^b × Selected^c
//
// (a, b, c) is one row of the operator's weights table, picked by the
// guest's mode: Nearby, Popular or Family (`params.modes`). Geometric
// weights, so within one mode only the ratios a : b : c change the order;
// 0 turns a signal off (x^0 = 1). Selected used to ride INSIDE Popularity's
// exponent (MESITA-2428), so Popular (b = 2) squared it and Nearby barely
// felt it; Pato split it out (MESITA-2439): "Proximity. Popularity.
// Selected."
//
// Gates are binary eligibility (0 or 1) and stay separate from the
// continuous signals, so diagnostics can say WHY a place is out (a gate)
// apart from why it is low (a signal). A place a gate closes is dropped, not
// ranked at 0. Gates: Family (every location), Radius (a point: inside the
// operator's circle), Territory (an area: inside its bounds). `Territory` is
// a backend word only; the guest never reads it.
//
// Selected is a signal, not a gate (Pato, 2026-10-18): 1 for a Mesita
// Selected place (an Enrich run completed and the profile is ready —
// curation, never payment), the operator's `params.selected.otherFactor`
// (default 0.3) for every other candidate. Never 0, so a strong Google-only
// place can still outrank a weak Selected one. Ties break on distance (a
// point only), then id.

import { popularity, proximity } from "./pipeline-signals.ts";
import { haversineKm } from "./geo.ts";

/** The Selected signal's two values (MESITA-2379). `other` is the default
 *  of the operator's `params.selected.otherFactor` (MESITA-2439). */
export const SELECTED_FACTOR = { selected: 1, other: 0.3 } as const;

/** Where a candidate's card comes from. `selected` = Mesita Selected;
 *  `mesita` = a ready Mesita row an Enrich run has not completed; `google`
 *  = a Google-only stub. */
export type AreaSource = "selected" | "mesita" | "google";

/** Selected: 1 for a Mesita Selected place, `other` for every other. */
export function selectedFactor(
  source: AreaSource,
  other: number = SELECTED_FACTOR.other,
): number {
  return source === "selected" ? SELECTED_FACTOR.selected : other;
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
  /** Proximity is 0 at this distance (km), apart from the radius. */
  reachKm: number;
  /** The mode's three exponents, one row of the weights table. */
  weights: AreaWeights;
  /** Selected's value for a non-Selected candidate; default 0.3. */
  selectedOther?: number;
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

/** The guest's mode (MESITA-2428): Nearby and Popular are every family,
 *  Family is one family. Each picks one row of the weights table. */
export const AREA_MODES = ["nearby", "popular", "family"] as const;
export type AreaMode = (typeof AREA_MODES)[number];

/** One row of the weights table: the three exponents (MESITA-2439). */
export type AreaWeights = { proximity: number; popularity: number; selected: number };

/** The wire's `prefer` (MESITA-2425): "popular" and "family" name their
 *  mode; anything else, "near" included, is Nearby. */
export function readAreaMode(v: unknown): AreaMode {
  return v === "popular" ? "popular" : v === "family" ? "family" : "nearby";
}

/** x^w with the table's guards: a missing or negative exponent is 0 (the
 *  signal is off), and 0^0 is 1. */
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
    territory: 0 | 1 | null;
    radius: 0 | 1 | null;
    active: 1;
    ready: 1 | null;
    reviews: 1 | null;
  };
  signals: { proximity: number | null; popularity: number | null };
  /** The Selected signal: 1, or `params.selected.otherFactor`. */
  selected: number;
  source: AreaSource;
  /** The mode's exponents (MESITA-2428; `selected` since MESITA-2439). */
  weights: AreaWeights;
  /** Proximity^a × Popularity^b (× territory), before Selected. */
  base: number;
  /** base × Selected^c. */
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
  const prox = loc.kind === "point" ? proximity(c, loc.anchor, ctx.reachKm) : null;
  const w = ctx.weights;
  const popPart = weighted(popN, w.popularity);
  const base = loc.kind === "point"
    ? weighted(prox ?? 0, w.proximity) * popPart
    : loc.kind === "area"
    ? (territory ?? 0) * popPart
    : popPart;
  const factor = selectedFactor(c.source, ctx.selectedOther);
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
    weights: { proximity: w.proximity, popularity: w.popularity, selected: w.selected },
    base: open ? base : 0,
    final: open ? base * weighted(factor, w.selected) : 0,
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
