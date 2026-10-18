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
