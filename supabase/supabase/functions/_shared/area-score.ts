// The gates and the two signals of the Map and Catalog pipelines (Area,
// MESITA-2327, split in two by MESITA-2909; one pool since MESITA-2379;
// points only since Territory was retired, MESITA-2500, MESITA-2603; the
// Premier factor since MESITA-2925, Selected's multiplier before it).
//
//   Map      final = Popularity × s           inside the screen radius
//   Catalog  no radius, the whole catalog, two lanes one and one
//            (MESITA-3016): red  final = Proximity × Popularity × s,
//            Premier places only; blue  final = Proximity × Popularity
//   no location (either)  final = Popularity × s
//
// THE SPLIT (Pato, MESITA-2909): on the Map distance is a SCREEN, never a
// sort ("como screening dentro del radio, pero no la metería ya para el
// sorting"): the Radius gate decides who is in and Popularity alone orders
// them. The Catalog has no radius: every Mesita place is ranked, and
// Proximity, 1 ÷ (1 + d ÷ D), D the operator's half distance
// (MESITA-3015), pulls nearer places up without ever cutting a far one.
// Popularity is ln(1 + reviews × stars), unbounded, and the product is never
// clamped or normalized (MESITA-2710). s is the Premier factor: a Premier
// place's paid tier, ×2 · ×5 · ×10 (`places.boost_tier`, MESITA-2789), and 1
// for every other place, at any distance. Selected and its operator boost
// died with MESITA-2925. No exponents (MESITA-2722).
//
// NO REACH (MESITA-3015): the reach (s only within 2 × h, MESITA-2920)
// existed because the log curve kept a far place alive. The reciprocal
// bounds Premier by itself: past D the score is D ÷ d, so a Premier 10X
// beats a place up to ~10× closer and a place in another city (100× the
// distance) never tops a guest's Home.
//
// Gates are binary eligibility (0 or 1) and stay separate from the
// continuous signals, so diagnostics can say WHY a place is out (a gate)
// apart from why it is low (a signal). A place a gate closes is dropped, not
// ranked at 0. Gates: Family (every location), Radius (a point with a
// radius: the Map, and Chat's read) and the Popularity floor. Ties break on
// distance (a point only), then id.

import { clearsPopularityFloor, logPopularity, proximity } from "./pipeline-signals.ts";
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
  /** Proximity's half distance D (km, MESITA-3015): the operator's
   *  `params.proximity.halfKm`. null = no Proximity: the Map ranks by
   *  Popularity alone. */
  halfKm: number | null;
  /** The Popularity floor (MESITA-2714): a place whose Popularity is under
   *  it is dropped, whatever its source; 0 or absent = off. */
  popularityFloor?: number;
  /** false = the blue lane (MESITA-3016): the Premier factor reads 1 for
   *  every place. Absent = true. */
  premier?: boolean;
};

/** The Catalog's two lanes (MESITA-3016): `red` holds Premier places
 *  only, ranked WITH the Premier factor; `blue` holds every place, ranked
 *  without it. The Map is red's score over every place. */
export type CatalogLane = "red" | "blue";

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
   *  `places.boost_tier` (0 · 1 · 2 · 3 = none · 2X · 5X · 10X); absent = 0. */
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
 *  was Boost MESITA-2789): a Premier place's tier, ×2 · ×5 · ×10
 *  (PREMIER_FACTOR); 1 for every other place and for a Google stub. */
export function premierFactor(c: Pick<AreaCandidate, "source" | "premierTier">): number {
  const tier = c.source === "google" ? 0 : c.premierTier ?? 0;
  return tier >= 3 ? PREMIER_FACTOR[3] : tier >= 2 ? PREMIER_FACTOR[2] : tier >= 1 ? PREMIER_FACTOR[1] : 1;
}

/** Popularity, or null when the place has no rating or no review count. */
function popularityOrNull(c: AreaCandidate): number | null {
  const ok = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  if (!ok(c.rating) || !ok(c.reviewCount)) return null;
  return logPopularity(c);
}

/** The score without Proximity: Popularity × the Premier factor. The
 *  whole score with no location. */
export function popularPart(c: AreaCandidate): number {
  return factor(popularityOrNull(c) ?? 0) * premierFactor(c);
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
    /** Popularity at or over the operator's floor (MESITA-2714); null when
     *  the floor is off. */
    popularity: 0 | 1 | null;
  };
  signals: { proximity: number | null; popularity: number | null };
  source: AreaSource;
  /** The factor `final` carries: the Premier factor (MESITA-2925), 1 for
   *  a place that is not Premier, at any distance (the reach went with
   *  MESITA-3015). The wire key predates Premier and is kept so the
   *  score tags read on. */
  selectedFactor: number;
  /** Popularity × selectedFactor, × Proximity on the Catalog. */
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
  const radius = loc.kind === "point" && loc.radiusKm !== null
    ? (km !== null && km <= loc.radiusKm ? 1 : 0)
    : null;
  // The Map passes no half distance: distance screens, never sorts
  // (MESITA-2909).
  const prox = loc.kind === "point" && ctx.halfKm !== null
    ? proximity(c, loc.anchor, ctx.halfKm)
    : null;
  const sel = ctx.premier === false ? 1 : premierFactor(c);
  const popPart = factor(pop ?? 0) * sel;
  const final = prox === null ? popPart : factor(prox) * popPart;
  // THE POPULARITY SCREEN (Pato, MESITA-2714: "if popularity score is
  // below 3 you cannot be shown … it doesn't matter what"): Google or
  // Mesita, Premier or not; no Google numbers reads 0, so it is out too.
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

/** Every gate open: Family, Radius when the point has one, and the
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

/**
 * THE LANE MERGE (Pato, MESITA-3016: "red blue, red blue … el que salga
 * primero lo ordena"; the ratio a stored number since MESITA-3033): one
 * red turn, then `bluePerRed` blue turns, red first, a fixed pattern
 * (never a coin flip per slot, which makes streaks in a short list). A
 * place already placed is skipped and the SAME lane reads its next one, so
 * a duplicate never breaks the pattern; once a lane runs dry the other
 * fills the rest in its own order. `bluePerRed` 0 is the blue list alone
 * (ads off; the caller short-circuits before reaching here, this keeps the
 * contract). Both lists are already ranked; nothing here reads SQL.
 */
export function interleaveLanes<T extends { id: string }>(
  red: readonly T[],
  blue: readonly T[],
  bluePerRed = 1,
): Array<{ lane: CatalogLane; item: T }> {
  const seen = new Set<string>();
  const out: Array<{ lane: CatalogLane; item: T }> = [];
  const lanes = { red: { list: red, at: 0 }, blue: { list: blue, at: 0 } };
  const next = (lane: CatalogLane): T | null => {
    const l = lanes[lane];
    while (l.at < l.list.length) {
      const item = l.list[l.at++];
      if (!seen.has(item.id)) return item;
    }
    return null;
  };
  const n = Number.isInteger(bluePerRed) && bluePerRed >= 0 ? bluePerRed : 1;
  if (n === 0) {
    for (const item of blue) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push({ lane: "blue", item });
    }
    return out;
  }
  // The period: one red turn, then n blue turns. A dry lane yields every
  // turn it has left; the other lane drains to the end, in both directions.
  const dry = { red: false, blue: false };
  let turn: CatalogLane = "red";
  let blueTurnsLeft = 0;
  for (;;) {
    if (dry.red && dry.blue) return out;
    if (dry[turn]) {
      turn = turn === "red" ? "blue" : "red";
      blueTurnsLeft = turn === "blue" ? n : 0;
      continue;
    }
    const item = next(turn);
    if (item) {
      seen.add(item.id);
      out.push({ lane: turn, item });
    } else {
      dry[turn] = true;
      continue;
    }
    if (turn === "red") {
      turn = "blue";
      blueTurnsLeft = n;
    } else if (--blueTurnsLeft <= 0) {
      turn = "red";
    }
  }
}
