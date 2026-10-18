// The Area score and its gates (MESITA-2327; weighted sum since MESITA-2347).
import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import {
  type AreaCandidate,
  type AreaContext,
  areaScore,
  familyGate,
  rankArea,
  selectedGate,
  weightedArea,
} from "./area-score.ts";

const ANCHOR = { lat: 19.43, lng: -99.13 };
const CTX: AreaContext = {
  anchor: ANCHOR,
  families: [],
  selectedOnly: false,
  radiusKm: 8,
  halfReviews: 100,
  balance: { proximity: 5, popularity: 5 },
};
const cand = (over: Partial<AreaCandidate> = {}): AreaCandidate => ({
  id: "a",
  lat: ANCHOR.lat,
  lng: ANCHOR.lng,
  rating: 4.5,
  reviewCount: 1000,
  familyKeys: ["dinner"],
  selected: true,
  ...over,
});

Deno.test("score = family × selected × (proximity × Pw + popularity × Qw) ÷ (Pw + Qw)", () => {
  const s = areaScore(cand({ rating: 4.0, reviewCount: 100 }), CTX);
  assertAlmostEquals(s.score, (s.proximity * 5 + s.popularity * 5) / 10, 1e-12);
  assertEquals(s.gates, { family: 1, selected: 1 });
  assertEquals(s.proximity, 1);
  assertAlmostEquals(s.popularity, 0.4, 1e-12);
});

Deno.test("the weights are the operator's: one at 0 hands the order to the other", () => {
  assertAlmostEquals(weightedArea(0.2, 0.9, { proximity: 10, popularity: 0 }), 0.2, 1e-12);
  assertAlmostEquals(weightedArea(0.2, 0.9, { proximity: 0, popularity: 10 }), 0.9, 1e-12);
  assertAlmostEquals(weightedArea(0.2, 0.9, { proximity: 3, popularity: 1 }), 0.375, 1e-12);
  // Both 0: every place ties at 0 and distance orders (rankArea's tie-break).
  assertEquals(weightedArea(0.2, 0.9, { proximity: 0, popularity: 0 }), 0);
  assertEquals(weightedArea(1, 1, { proximity: Number.NaN, popularity: -3 }), 0);
});

Deno.test("a missing number demotes, never deletes: an unrated place 50 m away still ranks above a loved one at the edge", () => {
  const unrated = cand({ id: "unrated", rating: null, reviewCount: null, lat: ANCHOR.lat + 0.05 / 111.195 });
  const edge = cand({ id: "edge", rating: 4.9, reviewCount: 5000, lat: ANCHOR.lat + 7.9 / 111.195 });
  const ranked = rankArea([edge, unrated], (c) => c, CTX);
  assertEquals(ranked.map((r) => r.item.id), ["unrated", "edge"]);
  assert(ranked[0].area.score > 0.45);
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

Deno.test("selected gate: off for Google Places; Mesita Selected only for the Selected scope", () => {
  assertEquals(selectedGate(false, false), 1);
  assertEquals(selectedGate(false, true), 0);
  assertEquals(selectedGate(true, true), 1);
});

Deno.test("a closed gate drops the candidate instead of ranking it at 0", () => {
  const ranked = rankArea(
    [cand({ id: "in" }), cand({ id: "out", familyKeys: ["coffee"] })],
    (c) => c,
    { ...CTX, families: ["dinner"] },
  );
  assertEquals(ranked.map((r) => r.item.id), ["in"]);
});

Deno.test("ties break on distance, then id: deterministic", () => {
  const ranked = rankArea(
    [
      cand({ id: "b", rating: null }),
      cand({ id: "a", rating: null }),
      cand({ id: "far", rating: null, lat: ANCHOR.lat + 0.05 }),
    ],
    (c) => c,
    CTX,
  );
  // No rating → popularity 0 → every score 0; distance then id order them.
  assertEquals(ranked.map((r) => r.item.id), ["a", "b", "far"]);
});

// ── MESITA-2338: the formula itself, not just the order ────────────────────

Deno.test("halfway to the edge Proximity is exactly ½, and the score is the mean of the two at equal weights", () => {
  // 4 km north of the anchor on an 8 km radius.
  const c = cand({ lat: ANCHOR.lat + 4 / 111.195, rating: 4.0, reviewCount: 100 });
  const s = areaScore(c, CTX);
  assertAlmostEquals(s.proximity, 0.5, 1e-3);
  assertAlmostEquals(s.score, (0.5 + 0.4) / 2, 1e-3);
  // A product would give 0.2; popularity alone 0.4.
  assertEquals(Math.abs(s.score - s.proximity * s.popularity) > 0.1, true);
});

Deno.test("a closed gate zeroes the score itself, not only the ranking", () => {
  assertEquals(areaScore(cand({ familyKeys: ["coffee"] }), { ...CTX, families: ["dinner"] }).score, 0);
  assertEquals(areaScore(cand({ selected: false }), { ...CTX, selectedOnly: true }).score, 0);
});

Deno.test("non-finite numbers never reach the sort", () => {
  const ranked = rankArea(
    [
      cand({ id: "nan", rating: Number.NaN, reviewCount: 10 }),
      cand({ id: "inf", rating: 4.5, reviewCount: Number.POSITIVE_INFINITY }),
      cand({ id: "ok", rating: 4.0, reviewCount: 50 }),
    ],
    (c) => c,
    CTX,
  );
  for (const r of ranked) assertEquals(Number.isFinite(r.area.score), true, r.item.id);
  assertEquals(ranked[0].item.id, "ok");
});
