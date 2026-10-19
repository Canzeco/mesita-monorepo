// The Area score, its gates and the Selected factor (MESITA-2327; weighted
// sum since MESITA-2347; one pool, Territory and the factor since
// MESITA-2379).
import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import {
  type AreaCandidate,
  type AreaContext,
  areaScore,
  balanceForPrefer,
  familyGate,
  rankArea,
  readAreaPrefer,
  SELECTED_FACTOR,
  selectedFactor,
  territoryGate,
  weightedArea,
} from "./area-score.ts";

const ANCHOR = { lat: 19.43, lng: -99.13 };
const CTX: AreaContext = {
  location: { kind: "point", anchor: ANCHOR, radiusKm: 8 },
  families: [],
  halfReviews: 100,
  balance: { proximity: 5, popularity: 5 },
};
const BOUNDS = { low: { lat: 19.4, lng: -99.2 }, high: { lat: 19.5, lng: -99.1 } };
const AREA: AreaContext = { ...CTX, location: { kind: "area", bounds: BOUNDS } };
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

Deno.test("point: final = (Proximity × Pw + Popularity × Qw) ÷ (Pw + Qw) × selected", () => {
  const s = areaScore(cand({ rating: 4.0, reviewCount: 100 }), CTX);
  assertEquals(s.formula, "point");
  assertEquals(s.signals.proximity, 1);
  assertAlmostEquals(s.signals.popularity!, 0.4, 1e-12);
  assertAlmostEquals(s.base, (1 * 5 + 0.4 * 5) / 10, 1e-12);
  assertEquals(s.selected, 1);
  assertAlmostEquals(s.final, s.base, 1e-12);
  assertEquals(s.gates.family, 1);
  assertEquals(s.gates.radius, 1);
  assertEquals(s.gates.territory, null);
});

Deno.test("Selected is a factor: 1.0 for Mesita Selected, 0.3 for everything else", () => {
  assertEquals(SELECTED_FACTOR, { selected: 1, other: 0.3 });
  assertEquals(selectedFactor("selected"), 1);
  assertEquals(selectedFactor("mesita"), 0.3);
  assertEquals(selectedFactor("google"), 0.3);
  const g = areaScore(cand({ source: "google" }), CTX);
  assertAlmostEquals(g.final, g.base * 0.3, 1e-12);
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

Deno.test("area: final = territory × Popularity × selected; no Proximity, no distance", () => {
  const inside = areaScore(cand({ lat: 19.45, lng: -99.15, rating: 4.0, reviewCount: 100 }), AREA);
  assertEquals(inside.formula, "area");
  assertEquals(inside.gates.territory, 1);
  assertEquals(inside.gates.radius, null);
  assertEquals(inside.signals.proximity, null);
  assertAlmostEquals(inside.final, 0.4, 1e-12);
  assertEquals(inside.distanceKm, null);
  const outside = areaScore(cand({ lat: 19.6, lng: -99.15 }), AREA);
  assertEquals(outside.gates.territory, 0);
  assertEquals(outside.final, 0);
});

Deno.test("area ranking ignores the rectangle's centre: ties break on id", () => {
  const ranked = rankArea(
    [
      cand({ id: "b", lat: 19.41, lng: -99.19, rating: null }),
      cand({ id: "a", lat: 19.45, lng: -99.15, rating: null }),
      cand({ id: "out", lat: 19.7, lng: -99.15 }),
    ],
    (c) => c,
    AREA,
  );
  assertEquals(ranked.map((r) => r.item.id), ["a", "b"]);
});

Deno.test("territory gate: inside the rectangle, edges included; unknown coordinates are out", () => {
  assertEquals(territoryGate({ lat: 19.4, lng: -99.2 }, BOUNDS), 1);
  assertEquals(territoryGate({ lat: 19.5, lng: -99.1 }, BOUNDS), 1);
  assertEquals(territoryGate({ lat: 19.51, lng: -99.15 }, BOUNDS), 0);
  assertEquals(territoryGate({ lat: null, lng: -99.15 }, BOUNDS), 0);
  // A rectangle across the antimeridian.
  const wrap = { low: { lat: -10, lng: 170 }, high: { lat: 10, lng: -170 } };
  assertEquals(territoryGate({ lat: 0, lng: 179 }, wrap), 1);
  assertEquals(territoryGate({ lat: 0, lng: 0 }, wrap), 0);
});

Deno.test("no location: final = Popularity × selected", () => {
  const s = areaScore(cand({ rating: 4.0, reviewCount: 100 }), NONE);
  assertEquals(s.formula, "none");
  assertEquals(s.signals.proximity, null);
  assertEquals(s.gates.radius, null);
  assertEquals(s.gates.territory, null);
  assertAlmostEquals(s.final, 0.4, 1e-12);
});

Deno.test("Popularity is null (n/a) when rating or count is missing, and scores as 0", () => {
  const s = areaScore(cand({ rating: null }), CTX);
  assertEquals(s.signals.popularity, null);
  assertAlmostEquals(s.base, (1 * 5 + 0) / 10, 1e-12);
  assertEquals(areaScore(cand({ reviewCount: null }), NONE).final, 0);
});

Deno.test("the weights are the operator's: one at 0 hands the order to the other", () => {
  assertAlmostEquals(weightedArea(0.2, 0.9, { proximity: 10, popularity: 0 }), 0.2, 1e-12);
  assertAlmostEquals(weightedArea(0.2, 0.9, { proximity: 0, popularity: 10 }), 0.9, 1e-12);
  assertAlmostEquals(weightedArea(0.2, 0.9, { proximity: 3, popularity: 1 }), 0.375, 1e-12);
  assertEquals(weightedArea(0.2, 0.9, { proximity: 0, popularity: 0 }), 0);
  assertEquals(weightedArea(1, 1, { proximity: Number.NaN, popularity: -3 }), 0);
});

Deno.test("a missing number demotes, never deletes: an unrated place 50 m away still ranks above a loved one at the edge", () => {
  const unrated = cand({ id: "unrated", rating: null, reviewCount: null, lat: ANCHOR.lat + 0.05 / 111.195 });
  const edge = cand({ id: "edge", rating: 4.9, reviewCount: 5000, lat: ANCHOR.lat + 7.9 / 111.195 });
  const ranked = rankArea([edge, unrated], (c) => c, CTX);
  assertEquals(ranked.map((r) => r.item.id), ["unrated", "edge"]);
  assert(ranked[0].area.final > 0.45);
});

Deno.test("family gate: no family is always out; any family with no ask; exact match when asked", () => {
  assertEquals(familyGate([], []), 0);
  assertEquals(familyGate(["undefined"], []), 0);
  assertEquals(familyGate(["go_out"], []), 1);
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
    { ...CTX, balance: { proximity: 0, popularity: 10 } },
  );
  assertEquals(ranked.map((r) => r.item.id), ["a", "b", "far"]);
});

Deno.test("halfway to the edge Proximity is exactly ½, and the score is the mean of the two at equal weights", () => {
  const c = cand({ lat: ANCHOR.lat + 4 / 111.195, rating: 4.0, reviewCount: 100 });
  const s = areaScore(c, CTX);
  assertAlmostEquals(s.signals.proximity!, 0.5, 1e-3);
  assertAlmostEquals(s.final, (0.5 + 0.4) / 2, 1e-3);
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

Deno.test("Near/Popular (MESITA-2425): Near keeps the operator's weights, Popular drops Proximity", () => {
  assertEquals(readAreaPrefer("popular"), "popular");
  assertEquals(readAreaPrefer("near"), "near");
  assertEquals(readAreaPrefer(undefined), "near");
  assertEquals(readAreaPrefer("POPULAR"), "near");
  const op = { proximity: 7, popularity: 3 };
  assertEquals(balanceForPrefer("near", op), op);
  assertEquals(balanceForPrefer("popular", op), { proximity: 0, popularity: 3 });
  assertEquals(balanceForPrefer("popular", { proximity: 5, popularity: 0 }), { proximity: 0, popularity: 1 });
  // Popular ranks a far, loved place over a near, unknown one inside the radius.
  const near: AreaCandidate = { id: "near", lat: ANCHOR.lat, lng: ANCHOR.lng, rating: 3.5, reviewCount: 5, familyKeys: ["dinner"], source: "google" };
  const far: AreaCandidate = { id: "far", lat: ANCHOR.lat + 0.05, lng: ANCHOR.lng, rating: 4.8, reviewCount: 3000, familyKeys: ["dinner"], source: "google" };
  const ctx = (prefer: "near" | "popular"): AreaContext => ({ ...CTX, balance: balanceForPrefer(prefer, op) });
  assertEquals(rankArea([near, far], (c) => c, ctx("popular"))[0].item.id, "far");
  assertEquals(rankArea([near, far], (c) => c, ctx("near"))[0].item.id, "near");
});
