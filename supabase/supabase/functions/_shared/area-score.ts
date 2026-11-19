// The gates and the score of the Map and Catalog pipelines (Area,
// MESITA-2327, split in two by MESITA-2909; one pool since MESITA-2379;
// points only since Territory was retired, MESITA-2500, MESITA-2603).
//
// DISCOVERY RANKING v2 (MESITA-4454): one formula on every screen, the
// numbers from a recipe row (`params.recipes`, discovery-config.ts):
//
//   final = Proximity × (stars ^ StarsExp × reviews) ^ GoogleExp
//           × premierFactor ^ PremierExp                 (pipeline-signals.ts)
//
// The Map's rows have no Proximity (distance is a SCREEN there, MESITA-2909:
// the Radius gate decides who is in, the score orders them); with no
// location Proximity abstains at 1. premierFactor is the paid tier, ×2 · ×5
// (`places.boost_tier`), and an Organic row's PremierExp is 0, so a plan
// never moves the organic list; the Inorganic (ad) lane ranks Premier places
// with its own row (area-pipeline.ts merges the two). The product is never
// clamped or normalized (MESITA-2710). A place with 0 reviews or no stars
// scores 0 and ranks last.
//
// Gates are binary eligibility (0 or 1) and stay separate from the score, so
// diagnostics can say WHY a place is out (a gate) apart from why it is low.
// A place a gate closes is dropped, not ranked at 0. Gates: Family (every
// location) and Radius (a point with a radius: the Map, and Chat's read).
// Ties break on distance then id (Catalog, Chat) or on id alone (the Map).

import { googlePopularity, type Recipe, recipeScore } from "./pipeline-signals.ts";
import { haversineKm } from "./geo.ts";
import { PREMIER_FACTOR } from "./boost.ts";

/** Where a candidate's card comes from: `mesita` = a ready Mesita row,
 *  `google` = a Google-only stub (never Premier). Selected is gone
 *  (MESITA-2925). */
export type AreaSource = "mesita" | "google";

export type LatLng = { lat: number; lng: number };
/** A rectangle: the Map's visible box, read only to measure the screen
 *  radius (MESITA-2511). Never a location: no view searches a rectangle. */
export type AreaBounds = { low: LatLng; high: LatLng };

/** Where the guest asked from: a point, or nowhere (Popularity alone). A
 *  point's `radiusKm` is the Radius gate (the Map's screen radius, Chat's
 *  read); null is no gate (the Catalog, MESITA-2909). Saved areas died with
 *  Territory (MESITA-2500). */
export type AreaLocation =
  | { kind: "point"; anchor: LatLng; radiusKm: number | null }
  | { kind: "none" };

/** What the guest asked of the Map or Catalog pipeline. */
export type AreaContext = {
  location: AreaLocation;
  /** Requested families; empty = no Family gate (every family passes). */
  families: readonly string[];
  /** The recipe row the score reads (MESITA-4454, `recipeFor`). A null
   *  `halfKm` is no Proximity: the Map's rows. */
  recipe: Recipe;
  /** Tie-break after the score: distance then id (the default: Catalog,
   *  Chat), or id alone (the Map, MESITA-4454). */
  ties?: "distance" | "id";
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
  /** Premier (MESITA-2925, was Boost MESITA-2789): the paid tier,
   *  `places.boost_tier` (0 · 1 · 2 = none · 2X · 5X); absent = 0. */
  premierTier?: number;
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

/** The Premier factor a candidate's score is multiplied by (MESITA-2925,
 *  was Boost MESITA-2789): a Premier place's tier, ×2 · ×5
 *  (PREMIER_FACTOR); 1 for every other place and for a Google stub. */
export function premierFactor(c: Pick<AreaCandidate, "source" | "premierTier">): number {
  const tier = c.source === "google" ? 0 : c.premierTier ?? 0;
  // A tier outside 0..2 (impossible past the DB check) earns no paid reach
  // (MESITA-3041): it reads 1, never the top rung.
  return tier === 2 ? PREMIER_FACTOR[2] : tier === 1 ? PREMIER_FACTOR[1] : 1;
}

/** Popularity, or null (n/a) when the place has no rating or no review
 *  count; 0 reviews is 0 (MESITA-4454). */
function popularityOrNull(c: AreaCandidate, recipe: Recipe): number | null {
  const ok = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  if (!ok(c.rating) || !ok(c.reviewCount)) return null;
  return googlePopularity(c, recipe.starsExp, recipe.googleExp);
}

/** One candidate's breakdown — the wire's `area` object (MESITA-2379).
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
    // `popularity` (the Area floor gate, MESITA-2714) retired in MESITA-3086.
  };
  signals: { proximity: number | null; popularity: number | null };
  source: AreaSource;
  /** premierFactor, the raw plan value (DX-e): 2 or 5 for a Premier place,
   *  1 for every other. The wire key predates Premier and is kept so the
   *  score tags read on. */
  selectedFactor: number;
  /** premierFactor ^ PremierExp, the scored value (DX-e): 1 on every
   *  Organic row (MESITA-4454). */
  premierBoost: number;
  /** Proximity (1 when n/a) × Popularity × premierBoost. */
  final: number;
  formula: "point" | "none";
};

export type AreaScore = AreaDiagnostics & { distanceKm: number | null };

export function areaScore(c: AreaCandidate, ctx: AreaContext): AreaScore {
  const loc = ctx.location;
  const pop = popularityOrNull(c, ctx.recipe);
  let km: number | null = null;
  if (loc.kind === "point" && typeof c.lat === "number" && typeof c.lng === "number") {
    const d = haversineKm(loc.anchor.lat, loc.anchor.lng, c.lat, c.lng);
    km = Number.isFinite(d) ? d : null;
  }
  const family = familyGate(c.familyKeys, ctx.families);
  const radius = loc.kind === "point" && loc.radiusKm !== null
    ? (km !== null && km <= loc.radiusKm ? 1 : 0)
    : null;
  const sel = premierFactor(c);
  // The Map's rows carry no half distance: distance screens, never sorts
  // (MESITA-2909). A place that cannot be measured from a point (no
  // coordinates) has Proximity 0.
  const score = recipeScore(c, km, loc.kind === "point", sel, ctx.recipe);
  const final = factor(score.proximity ?? 1) * factor(score.popularity) * score.premierBoost;
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
    signals: { proximity: score.proximity, popularity: pop },
    source: c.source,
    selectedFactor: sel,
    premierBoost: score.premierBoost,
    final: open && Number.isFinite(final) ? final : 0,
    formula: loc.kind,
    distanceKm: km,
  };
}

/** Every gate open: Family, and Radius when the point has one. */
export function areaGatesOpen(a: AreaDiagnostics): boolean {
  return a.gates.family === 1 && a.gates.radius !== 0;
}

/**
 * Rank candidates: gate, score, then sort by final score, distance (a point
 * location, unless `ties` is "id") and id. Returns each eligible candidate with its breakdown, best
 * first.
 */
export function rankArea<T>(
  items: readonly T[],
  toCandidate: (item: T) => AreaCandidate,
  ctx: AreaContext,
): Array<{ item: T; area: AreaScore }> {
  const byId = ctx.ties === "id";
  return items
    .map((item) => ({ item, candidate: toCandidate(item) }))
    .map(({ item, candidate }) => ({ item, id: candidate.id, area: areaScore(candidate, ctx) }))
    .filter(({ area }) => areaGatesOpen(area))
    .sort((a, b) =>
      b.area.final - a.area.final ||
      (byId ? 0 : (a.area.distanceKm ?? Infinity) - (b.area.distanceKm ?? Infinity)) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    )
    .map(({ item, area }) => ({ item, area }));
}
