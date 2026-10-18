// The four Discovery signals (MESITA-2327): formulas and missing-data policy.
import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import {
  descriptionSimilarity,
  lexicalNameSimilarity,
  nameSimilarity,
  popularity,
  POPULARITY_REFERENCE_RATING_DEFAULT,
  POPULARITY_REFERENCE_REVIEWS_DEFAULT,
  proximity,
  proximityFromDistance,
  PROXIMITY_HALF_DISTANCE_KM_DEFAULT,
  rawPopularity,
} from "./pipeline-signals.ts";

const REF = {
  rating: POPULARITY_REFERENCE_RATING_DEFAULT,
  reviews: POPULARITY_REFERENCE_REVIEWS_DEFAULT,
};

Deno.test("proximity: 1 at the anchor, ½ at the half distance, ¼ at twice it, never below 0", () => {
  const h = 3;
  assertEquals(proximityFromDistance(0, h), 1);
  assertAlmostEquals(proximityFromDistance(h, h), 0.5, 1e-12);
  assertAlmostEquals(proximityFromDistance(2 * h, h), 0.25, 1e-12);
  assertAlmostEquals(proximityFromDistance(1, h), Math.exp(-Math.LN2 / h), 1e-12);
  assert(proximityFromDistance(10_000, h) >= 0);
  assert(proximityFromDistance(1, h) < 1);
});

Deno.test("proximity: the provisional half distance keeps the old curve's midpoint (4.1 km)", () => {
  // The replaced curve: 1 − ln(1 + d/knee) ÷ ln(1 + max/knee), max 25, knee 1.
  const old = (d: number) => 1 - Math.log1p(d) / Math.log1p(25);
  assertEquals(PROXIMITY_HALF_DISTANCE_KM_DEFAULT, 4.1);
  assertAlmostEquals(old(Math.sqrt(26) - 1), 0.5, 1e-12);
  assertAlmostEquals(Math.sqrt(26) - 1, PROXIMITY_HALF_DISTANCE_KM_DEFAULT, 0.01);
});

Deno.test("proximity missing data: no anchor abstains at 1; no coordinates is 0", () => {
  assertEquals(proximity({ lat: 1, lng: 1 }, null, 4), 1);
  assertEquals(proximity({ lat: null, lng: null }, { lat: 0, lng: 0 }, 4), 0);
});

Deno.test("popularity: ln(1 + rating × reviews), normalized by the reference, clamped to 0..1", () => {
  assertAlmostEquals(rawPopularity(4.5, 1000), Math.log1p(4500), 1e-12);
  assertEquals(popularity({ rating: 4.5, reviewCount: 1000 }, REF), 1);
  assertEquals(popularity({ rating: 4.9, reviewCount: 50_000 }, REF), 1);
  const mid = popularity({ rating: 4.0, reviewCount: 100 }, REF);
  assertAlmostEquals(mid, Math.log1p(400) / Math.log1p(4500), 1e-12);
  assert(mid > 0 && mid < 1);
  // Volume matters: a 5.0 from three people scores below a 4.6 from nine hundred.
  assert(
    popularity({ rating: 5, reviewCount: 3 }, REF) <
      popularity({ rating: 4.6, reviewCount: 900 }, REF),
  );
});

Deno.test("popularity missing data: no rating or no review count is 0 (no new-place prior)", () => {
  assertEquals(popularity({ rating: null, reviewCount: 300 }, REF), 0);
  assertEquals(popularity({ rating: 4.8, reviewCount: null }, REF), 0);
  assertEquals(popularity({ rating: 4.8, reviewCount: 0 }, REF), 0);
});

Deno.test("name: the embedding cosine when both vectors exist", () => {
  const sim = nameSimilarity(
    { text: "pangea", vector: [1, 0, 0] },
    { name: "Pangea", nameEmbedding: [0.8, 0.6, 0] },
  );
  assertEquals(sim.method, "embedding");
  assertAlmostEquals(sim.score, 0.8, 1e-9);
});

Deno.test("name missing data: no embedding falls back to lexical, never a silent 0", () => {
  const noPlaceVec = nameSimilarity({ text: "Pangea", vector: [1, 0] }, { name: "Pangea", nameEmbedding: null });
  assertEquals(noPlaceVec, { score: 1, method: "lexical" });
  const noQueryVec = nameSimilarity({ text: "tacos el", vector: null }, { name: "Tacos el Güero" });
  assertEquals(noQueryVec.method, "lexical");
  assert(noQueryVec.score >= 0.8, "a typed prefix is a strong hit");
  assertEquals(lexicalNameSimilarity("Café Nin", "cafe nin"), 1);
  assert(lexicalNameSimilarity("sushi", "Pangea") < 0.2);
});

Deno.test("description: cosine of the request against the summary; no summary vector cannot judge", () => {
  assertAlmostEquals(descriptionSimilarity([1, 0], [1, 0])!, 1, 1e-12);
  assertEquals(descriptionSimilarity([1, 0], null), null);
  assertEquals(descriptionSimilarity([1, 0, 0], [1, 0]), null);
});
