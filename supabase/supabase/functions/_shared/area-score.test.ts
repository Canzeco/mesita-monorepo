// The Area score, its gates and the Selected factor (MESITA-2327; weighted
// sum since MESITA-2347; one pool and the factor since MESITA-2379; points
// only since Territory was retired, MESITA-2603).
import { assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import {
  type AreaCandidate,
  type AreaContext,
  areaScore,
  familyGate,
  insideBounds,
  rankArea,
  readAreaMode,
  SELECTED_FACTOR,
  selectedFactor,
} from "./area-score.ts";

const ANCHOR = { lat: 19.43, lng: -99.13 };
const CTX: AreaContext = {
  location: { kind: "point", anchor: ANCHOR, radiusKm: 8 },
  families: [],
  halfReviews: 100,
  reachKm: 8,
  weights: { proximity: 1, popularity: 1, selected: 1 },
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

Deno.test("point: final = Proximity^a × Popularity^b × Selected^c", () => {
  const s = areaScore(cand({ rating: 4.0, reviewCount: 100 }), CTX);
  assertEquals(s.formula, "point");
  assertEquals(s.signals.proximity, 1);
  assertAlmostEquals(s.signals.popularity!, 0.4, 1e-12);
  assertAlmostEquals(s.base, 1 * 0.4, 1e-12);
  assertEquals(s.weights, { proximity: 1, popularity: 1, selected: 1 });
  assertEquals(s.selected, 1);
  assertAlmostEquals(s.final, s.base, 1e-12);
  assertEquals(s.gates.family, 1);
  assertEquals(s.gates.radius, 1);
  // Territory is gone from the breakdown (MESITA-2603).
  assertEquals(Object.keys(s.gates).sort(), ["active", "family", "radius", "ready", "reviews"]);
});

Deno.test("Selected is its own signal (MESITA-2439): 1.0 for Mesita Selected, 0.3 for everything else, with its own exponent", () => {
  assertEquals(SELECTED_FACTOR, { selected: 1, other: 0.3 });
  assertEquals(selectedFactor("selected"), 1);
  assertEquals(selectedFactor("mesita"), 0.3);
  assertEquals(selectedFactor("google"), 0.3);
  assertEquals(selectedFactor("google", 0.5), 0.5);
  assertEquals(selectedFactor("selected", 0.5), 1);
  const g = areaScore(cand({ source: "google" }), CTX);
  assertAlmostEquals(g.final, g.base * 0.3, 1e-12);
  // Popularity squared no longer squares Selected: c alone raises it.
  const sq = areaScore(cand({ source: "google" }), {
    ...CTX,
    weights: { proximity: 1, popularity: 2, selected: 1 },
  });
  assertAlmostEquals(sq.final, sq.base * 0.3, 1e-12);
  const c2 = areaScore(cand({ source: "google" }), {
    ...CTX,
    weights: { proximity: 1, popularity: 1, selected: 2 },
  });
  assertAlmostEquals(c2.final, c2.base * 0.09, 1e-12);
  // Popularity off keeps Selected; Selected off ignores it.
  const popOff = areaScore(cand({ source: "google" }), {
    ...CTX,
    weights: { proximity: 1, popularity: 0, selected: 1 },
  });
  assertAlmostEquals(popOff.final, popOff.base * 0.3, 1e-12);
  const selOff = areaScore(cand({ source: "google" }), {
    ...CTX,
    weights: { proximity: 1, popularity: 1, selected: 0 },
  });
  assertAlmostEquals(selOff.final, selOff.base, 1e-12);
  // The operator's value for a non-Selected place.
  const other = areaScore(cand({ source: "mesita" }), { ...CTX, selectedOther: 0.5 });
  assertEquals(other.selected, 0.5);
  assertAlmostEquals(other.final, other.base * 0.5, 1e-12);
  assertEquals(g.source, "google");
});

Deno.test("a strong Google-only place can outrank a weak Selected one", () => {
  const strong = cand({ id: "strong", source: "google", rating: 4.9, reviewCount: 5000 });
  const weak = cand({ id: "weak", source: "selected", rating: 2.0, reviewCount: 3, lat: ANCHOR.lat + 7.5 / 111.195 });
  const ranked = rankArea([weak, strong], (c) => c, CTX);
  assertEquals(ranked.map((r) => r.item.id), ["strong", "weak"]);
  // …and the same two at equal strength go Selected first.
  const twin = rankArea([cand({ id: "g", source: "google" }), cand({ id: "s" })], (c) => c, CTX);
  assertEquals(twin.map((r) => r.item.id), ["s", "g"]);
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

Deno.test("no location: final = (Popularity × selected)^b", () => {
  const s = areaScore(cand({ rating: 4.0, reviewCount: 100 }), NONE);
  assertEquals(s.formula, "none");
  assertEquals(s.signals.proximity, null);
  assertEquals(s.gates.radius, null);
  assertAlmostEquals(s.final, 0.4, 1e-12);
});

Deno.test("Popularity is null (n/a) when rating or count is missing, and scores as 0", () => {
  const s = areaScore(cand({ rating: null }), CTX);
  assertEquals(s.signals.popularity, null);
  assertEquals(s.base, 0);
  assertEquals(areaScore(cand({ reviewCount: null }), NONE).final, 0);
  // Popularity off: the missing number no longer matters.
  assertEquals(areaScore(cand({ rating: null }), { ...CTX, weights: { proximity: 1, popularity: 0, selected: 1 } }).final, 1);
});

Deno.test("the weights are exponents: 0 hands the order to the other, and only the ratio orders", () => {
  const a = cand({ id: "a", lat: ANCHOR.lat + 1 / 111.195, rating: 3.5, reviewCount: 50 });
  const b = cand({ id: "b", lat: ANCHOR.lat + 5 / 111.195, rating: 4.9, reviewCount: 3000 });
  const order = (proximity: number, popularity: number) =>
    rankArea([a, b], (c) => c, { ...CTX, weights: { proximity, popularity, selected: 1 } }).map((r) => r.item.id);
  assertEquals(order(1, 0), ["a", "b"]);
  assertEquals(order(0, 1), ["b", "a"]);
  assertEquals(order(2, 1), order(4, 2));
  assertEquals(order(1, 2), order(2, 4));
  // Both off: every place scores 1 and distance orders.
  assertEquals(order(0, 0), ["a", "b"]);
  const s = areaScore(cand(), { ...CTX, weights: { proximity: Number.NaN, popularity: -3, selected: 1 } });
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
    { ...CTX, weights: { proximity: 0, popularity: 1, selected: 1 } },
  );
  assertEquals(ranked.map((r) => r.item.id), ["a", "b", "far"]);
});

Deno.test("halfway to the edge Proximity is exactly ½, and the score is the product at weights 1 · 1", () => {
  const c = cand({ lat: ANCHOR.lat + 4 / 111.195, rating: 4.0, reviewCount: 100 });
  const s = areaScore(c, CTX);
  assertAlmostEquals(s.signals.proximity!, 0.5, 1e-3);
  assertAlmostEquals(s.final, 0.5 * 0.4, 1e-3);
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

Deno.test("the mode (MESITA-2428): near · popular · family on the wire; Nearby favours the close place, Popular the loved one", () => {
  assertEquals(readAreaMode("popular"), "popular");
  assertEquals(readAreaMode("family"), "family");
  assertEquals(readAreaMode("near"), "nearby");
  assertEquals(readAreaMode(undefined), "nearby");
  assertEquals(readAreaMode("POPULAR"), "nearby");
  const near: AreaCandidate = { id: "near", lat: ANCHOR.lat + 1 / 111.195, lng: ANCHOR.lng, rating: 4.0, reviewCount: 150, familyKeys: ["dinner"], source: "google" };
  const far: AreaCandidate = { id: "far", lat: ANCHOR.lat + 4 / 111.195, lng: ANCHOR.lng, rating: 4.8, reviewCount: 3000, familyKeys: ["dinner"], source: "google" };
  const first = (proximity: number, popularity: number) =>
    rankArea([near, far], (c) => c, { ...CTX, weights: { proximity, popularity, selected: 1 } })[0].item.id;
  assertEquals(first(2, 1), "near");
  assertEquals(first(1, 2), "far");
});

// MESITA-2431: Proximity scores over its own reach, not the candidate radius.
// Live was a 50 km radius scoring a city between 0.7 and 1, so Nearby put a
// 4.6★ place 6 km away ahead of a 4.0★ one 0.5 km away.
Deno.test("Proximity reads the reach, not the radius (MESITA-2431)", () => {
  const MTY = { lat: 25.65, lng: -100.29 };
  const kmLat = (km: number) => MTY.lat + km / 111.2;
  const close = cand({ id: "close", lat: kmLat(0.5), lng: MTY.lng, rating: 4.0, reviewCount: 300 });
  const big = cand({ id: "big", lat: kmLat(6), lng: MTY.lng, rating: 4.6, reviewCount: 3000 });
  const ctx = (reachKm: number, proximity: number, popularity: number): AreaContext => ({
    ...CTX,
    location: { kind: "point", anchor: MTY, radiusKm: 50 },
    reachKm,
    weights: { proximity, popularity, selected: 1 },
  });
  const first = (c: AreaContext) => rankArea([big, close], (x) => x, c)[0].item.id;
  // The radius still decides who is a candidate; the reach only scores.
  const at = areaScore(big, ctx(15, 1, 1));
  assertEquals(at.gates.radius, 1);
  assertAlmostEquals(at.signals.proximity ?? -1, 1 - 6 / 15, 1e-2);
  assertEquals(areaScore(cand({ lat: kmLat(20), lng: MTY.lng }), ctx(15, 1, 1)).signals.proximity, 0);
  // Reach 15: Nearby leads with the close place, Popular still pulls the big name.
  assertEquals(first(ctx(15, 2, 1)), "close");
  assertEquals(first(ctx(15, 1, 2)), "big");
  // Reach = the 50 km radius (the old behaviour): Nearby lost the close place.
  assertEquals(first(ctx(50, 2, 1)), "big");
});
