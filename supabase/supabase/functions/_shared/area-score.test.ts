// The Area score and its gates (MESITA-2327).
import { assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import { type AreaCandidate, type AreaContext, areaScore, familyGate, rankArea, selectedGate } from "./area-score.ts";

const ANCHOR = { lat: 19.43, lng: -99.13 };
const CTX: AreaContext = {
  anchor: ANCHOR,
  families: [],
  selectedOnly: false,
  halfDistanceKm: 4,
  popularityReference: { rating: 4.5, reviews: 1000 },
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

Deno.test("score = family × selected × proximity × popularity, exponents 1, no weights", () => {
  const s = areaScore(cand({ rating: 4.0, reviewCount: 100 }), CTX);
  assertAlmostEquals(s.score, s.proximity * s.popularity, 1e-12);
  assertEquals(s.gates, { family: 1, selected: 1 });
  assertEquals(s.proximity, 1);
});

Deno.test("family gate: open with no ask; exact family match; unknown family is out when asked", () => {
  assertEquals(familyGate([], []), 1);
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

// ── MESITA-2338: the product formula, not just the order ───────────────────

Deno.test("the score at the half distance is exactly ½ × popularity (a product, no weights)", () => {
  // 4 km north of the anchor with a 4 km half distance.
  const c = cand({ lat: ANCHOR.lat + 4 / 111.195, rating: 4.0, reviewCount: 100 });
  const s = areaScore(c, CTX);
  assertAlmostEquals(s.proximity, 0.5, 1e-3);
  assertAlmostEquals(s.score, 0.5 * s.popularity, 1e-3);
  // Popularity alone or a sum would not give this.
  assertEquals(Math.abs(s.score - s.popularity) > 0.1, true);
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
