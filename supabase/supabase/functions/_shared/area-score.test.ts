// The Area score and its gates (MESITA-2327; one pool since MESITA-2379;
// points only since Territory was retired, MESITA-2603; Proximity^a ×
// Popularity^b since MESITA-2703; Proximity ½ at the operator's
// half-distance, whatever the radius, since MESITA-2706).
import { assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import {
  type AreaCandidate,
  type AreaContext,
  areaScore,
  familyGate,
  insideBounds,
  rankArea,
} from "./area-score.ts";

const ANCHOR = { lat: 19.43, lng: -99.13 };
/** Popularity of a 4.0★ place with 100 reviews: ln(1 + 100 × 4) ≈ 5.99
 *  (MESITA-2710). */
const POP = Math.log1p(400);
const CTX: AreaContext = {
  location: { kind: "point", anchor: ANCHOR, radiusKm: 8 },
  families: [],
  halfKm: 4,
  weights: { proximity: 1, popularity: 1 },
};
const BOUNDS = { low: { lat: 19.4, lng: -99.2 }, high: { lat: 19.5, lng: -99.1 } };
const NONE: AreaContext = { ...CTX, location: { kind: "none" } };
const cand = (over: Partial<AreaCandidate> = {}): AreaCandidate => ({
  id: "a",
  lat: ANCHOR.lat,
  lng: ANCHOR.lng,
  rating: 4.5,
  reviewCount: 1000,
  familyKeys: ["dinner"],
  source: "selected",
  ...over,
});

Deno.test("point: final = Proximity^a × Popularity^b", () => {
  const s = areaScore(cand({ rating: 4.0, reviewCount: 100 }), CTX);
  assertEquals(s.formula, "point");
  assertEquals(s.signals.proximity, 1);
  assertAlmostEquals(s.signals.popularity!, POP, 1e-12);
  assertAlmostEquals(s.final, 1 * POP, 1e-12);
  assertEquals(s.weights, { proximity: 1, popularity: 1 });
  assertEquals(s.gates.family, 1);
  assertEquals(s.gates.radius, 1);
  // Territory is gone from the breakdown (MESITA-2603).
  assertEquals(Object.keys(s.gates).sort(), ["active", "family", "radius", "ready", "reviews"]);
});

Deno.test("Selected no longer scores (MESITA-2703): equal signals score equal whatever the source", () => {
  const sel = areaScore(cand({ source: "selected" }), CTX);
  const mes = areaScore(cand({ source: "mesita" }), CTX);
  const goo = areaScore(cand({ source: "google" }), CTX);
  assertEquals(sel.final, mes.final);
  assertEquals(sel.final, goo.final);
  assertEquals("selected" in sel, false);
  // The source stays as provenance.
  assertEquals(goo.source, "google");
  const twin = rankArea([cand({ id: "g", source: "google" }), cand({ id: "s" })], (c) => c, CTX);
  assertEquals(twin.map((r) => r.item.id), ["g", "s"]);
});

Deno.test("insideBounds (the screen radius's cross check): edges included; unknown coordinates are out", () => {
  assertEquals(insideBounds({ lat: 19.4, lng: -99.2 }, BOUNDS), true);
  assertEquals(insideBounds({ lat: 19.5, lng: -99.1 }, BOUNDS), true);
  assertEquals(insideBounds({ lat: 19.51, lng: -99.15 }, BOUNDS), false);
  assertEquals(insideBounds({ lat: null, lng: -99.15 }, BOUNDS), false);
  // A rectangle across the antimeridian.
  const wrap = { low: { lat: -10, lng: 170 }, high: { lat: 10, lng: -170 } };
  assertEquals(insideBounds({ lat: 0, lng: 179 }, wrap), true);
  assertEquals(insideBounds({ lat: 0, lng: 0 }, wrap), false);
});

Deno.test("no location: final = Popularity^b", () => {
  const s = areaScore(cand({ rating: 4.0, reviewCount: 100 }), NONE);
  assertEquals(s.formula, "none");
  assertEquals(s.signals.proximity, null);
  assertEquals(s.gates.radius, null);
  assertAlmostEquals(s.final, POP, 1e-12);
});

Deno.test("Popularity is null (n/a) when rating or count is missing, and scores as 0", () => {
  const s = areaScore(cand({ rating: null }), CTX);
  assertEquals(s.signals.popularity, null);
  assertEquals(s.final, 0);
  assertEquals(areaScore(cand({ reviewCount: null }), NONE).final, 0);
  // Popularity off (b = 0): the missing number no longer matters.
  assertEquals(areaScore(cand({ rating: null }), { ...CTX, weights: { proximity: 1, popularity: 0 } }).final, 1);
});

Deno.test("the weights are exponents: 0 hands the order to the other, and only the ratio orders", () => {
  const a = cand({ id: "a", lat: ANCHOR.lat + 1 / 111.195, rating: 3.5, reviewCount: 50 });
  const b = cand({ id: "b", lat: ANCHOR.lat + 5 / 111.195, rating: 4.9, reviewCount: 3000 });
  const order = (proximity: number, popularity: number) =>
    rankArea([a, b], (c) => c, { ...CTX, weights: { proximity, popularity } }).map((r) => r.item.id);
  assertEquals(order(1, 0), ["a", "b"]);
  assertEquals(order(0, 1), ["b", "a"]);
  assertEquals(order(2, 1), order(4, 2));
  assertEquals(order(1, 2), order(2, 4));
  // Both off: every place scores 1 and distance orders.
  assertEquals(order(0, 0), ["a", "b"]);
  const s = areaScore(cand(), { ...CTX, weights: { proximity: Number.NaN, popularity: -3 } });
  assertEquals(s.final, 1);
});

Deno.test("a missing number sinks a place to the bottom, never off the list (MESITA-2428)", () => {
  const unrated = cand({ id: "unrated", rating: null, reviewCount: null, lat: ANCHOR.lat + 0.05 / 111.195 });
  const edge = cand({ id: "edge", rating: 4.9, reviewCount: 5000, lat: ANCHOR.lat + 7.9 / 111.195 });
  const ranked = rankArea([unrated, edge], (c) => c, CTX);
  assertEquals(ranked.map((r) => r.item.id), ["edge", "unrated"]);
  assertEquals(ranked[1].area.final, 0);
});

Deno.test("family gate: no family is always out; any family with no ask; exact match when asked", () => {
  assertEquals(familyGate([], []), 0);
  assertEquals(familyGate(["undefined"], []), 0);
  assertEquals(familyGate(["night_out"], []), 1);
  assertEquals(familyGate(["dinner"], ["dinner", "drinks"]), 1);
  assertEquals(familyGate(["coffee"], ["dinner"]), 0);
  assertEquals(familyGate([], ["dinner"]), 0);
  assertEquals(familyGate(["undefined"], ["dinner"]), 0);
});

Deno.test("a closed gate drops the candidate instead of ranking it at 0", () => {
  const ranked = rankArea(
    [cand({ id: "in" }), cand({ id: "out", familyKeys: ["coffee"] }), cand({ id: "far", lat: ANCHOR.lat + 0.2 })],
    (c) => c,
    { ...CTX, families: ["dinner"] },
  );
  assertEquals(ranked.map((r) => r.item.id), ["in"]);
});

Deno.test("a closed gate zeroes the score itself, not only the ranking", () => {
  assertEquals(areaScore(cand({ familyKeys: ["coffee"] }), { ...CTX, families: ["dinner"] }).final, 0);
  assertEquals(areaScore(cand({ lat: ANCHOR.lat + 0.2 }), CTX).gates.radius, 0);
  assertEquals(areaScore(cand({ lat: ANCHOR.lat + 0.2 }), CTX).final, 0);
});

Deno.test("ties break on distance, then id: deterministic", () => {
  const ranked = rankArea(
    [
      cand({ id: "b", rating: null }),
      cand({ id: "a", rating: null }),
      cand({ id: "far", rating: null, lat: ANCHOR.lat + 0.05 }),
    ],
    (c) => c,
    { ...CTX, weights: { proximity: 0, popularity: 1 } },
  );
  assertEquals(ranked.map((r) => r.item.id), ["a", "b", "far"]);
});

Deno.test("at the half-distance Proximity is exactly ½, and the score is the product at weights 1 · 1", () => {
  const c = cand({ lat: ANCHOR.lat + 4 / 111.195, rating: 4.0, reviewCount: 100 });
  const s = areaScore(c, CTX);
  assertAlmostEquals(s.signals.proximity!, 0.5, 1e-3);
  assertAlmostEquals(s.final, 0.5 * POP, 1e-3);
});

Deno.test("the breakdown carries the operational gates the sources applied", () => {
  const google = areaScore(cand({ source: "google", ready: null, reviews: 1 }), CTX);
  assertEquals(google.gates.ready, null);
  assertEquals(google.gates.reviews, 1);
  assertEquals(google.gates.active, 1);
  const mesita = areaScore(cand({ source: "mesita", ready: 1, reviews: null }), CTX);
  assertEquals(mesita.gates.ready, 1);
  assertEquals(mesita.gates.reviews, null);
  assertEquals(mesita.familyKeys, ["dinner"]);
});

Deno.test("non-finite numbers never reach the sort", () => {
  const ranked = rankArea(
    [
      cand({ id: "nan", rating: Number.NaN, reviewCount: 10 }),
      cand({ id: "inf", rating: 4.5, reviewCount: Number.POSITIVE_INFINITY }),
      cand({ id: "ok", rating: 4.0, reviewCount: 50 }),
    ],
    (c) => c,
    NONE,
  );
  for (const r of ranked) assertEquals(Number.isFinite(r.area.final), true, r.item.id);
  assertEquals(ranked[0].item.id, "ok");
});

Deno.test("Proximity's half-distance is the operator's and never follows the radius (MESITA-2706)", () => {
  // D = 1.5 km: 1.5 km out scores ½ on a 3 km circle and on a 30 km one alike.
  const ctx: AreaContext = {
    ...CTX,
    location: { kind: "point", anchor: ANCHOR, radiusKm: 3 },
    halfKm: 1.5,
  };
  const mid = cand({ lat: ANCHOR.lat + 1.5 / 111.195 });
  assertAlmostEquals(areaScore(mid, ctx).signals.proximity!, 0.5, 1e-3);
  const wide: AreaContext = { ...ctx, location: { kind: "point", anchor: ANCHOR, radiusKm: 30 } };
  assertAlmostEquals(areaScore(mid, wide).signals.proximity!, 0.5, 1e-3);
  // The edge is not 0 any more: 2.999 km of a 3 km circle keeps ⅓, and the
  // Radius gate, not the curve, drops what lies past the circle.
  const edge = cand({ lat: ANCHOR.lat + 2.999 / 111.195, rating: 4.0, reviewCount: 100 });
  assertAlmostEquals(areaScore(edge, ctx).signals.proximity!, 1 / 3, 1e-3);
  assertAlmostEquals(areaScore(edge, ctx).final, POP / 3, 1e-3);
  assertEquals(areaScore(cand({ lat: ANCHOR.lat + 3.1 / 111.195 }), ctx).gates.radius, 0);
  // a = 0 ignores distance: the edge place scores its Popularity alone (x^0 = 1).
  assertAlmostEquals(areaScore(edge, { ...ctx, weights: { proximity: 0, popularity: 1 } }).final, POP, 1e-12);
  // b = 0 ignores popularity: an unrated place at the point scores 1.
  assertEquals(
    areaScore(cand({ rating: null, reviewCount: null }), { ...ctx, weights: { proximity: 1, popularity: 0 } }).final,
    1,
  );
});

Deno.test("Popularity is ln(1 + reviews × stars), never normalized, and the product is never clamped (MESITA-2710)", () => {
  const big = areaScore(cand({ rating: 4.6, reviewCount: 1000 }), NONE);
  assertAlmostEquals(big.signals.popularity!, Math.log1p(4600), 1e-12);
  assertEquals(big.signals.popularity! > 1, true);
  // b = 2 squares it: a plain power, no cap at 1.
  const sq = areaScore(cand({ rating: 4.6, reviewCount: 1000 }), { ...NONE, weights: { proximity: 1, popularity: 2 } });
  assertAlmostEquals(sq.final, Math.log1p(4600) ** 2, 1e-9);
  // No reviews: 0, not -Infinity.
  assertEquals(areaScore(cand({ reviewCount: 0 }), NONE).signals.popularity, 0);
  // More reviews at the same stars always rank higher; stars count too.
  const order = rankArea(
    [cand({ id: "few", reviewCount: 30, rating: 4.9 }), cand({ id: "many", reviewCount: 3000, rating: 4.2 })],
    (c) => c,
    NONE,
  );
  assertEquals(order.map((r) => r.item.id), ["many", "few"]);
});
