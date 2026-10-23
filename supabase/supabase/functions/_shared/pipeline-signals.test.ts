// The four Discovery signals (MESITA-2327): formulas and missing-data policy.
import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import {
  descriptionSimilarity,
  lexicalNameSimilarity,
  nameSimilarity,
  normalizeName,
  popularity,
  POPULARITY_HALF_REVIEWS_DEFAULT,
  proximity,
  PROXIMITY_HALF_KM_DEFAULT,
  proximityFromDistance,
} from "./pipeline-signals.ts";

const K = POPULARITY_HALF_REVIEWS_DEFAULT;
const D = PROXIMITY_HALF_KM_DEFAULT;

Deno.test("proximity: 1 ÷ (1 + d ÷ D) — 1 at the point, ½ at D, ⅓ at 2D, never 0 (MESITA-2706)", () => {
  assertEquals(proximityFromDistance(0, D), 1);
  assertAlmostEquals(proximityFromDistance(D, D), 0.5, 1e-12);
  assertAlmostEquals(proximityFromDistance(2 * D, D), 1 / 3, 1e-12);
  assertAlmostEquals(proximityFromDistance(D / 2, D), 2 / 3, 1e-12);
  // The edge of a circle is never 0: the Radius gate drops what lies past it.
  assert(proximityFromDistance(10_000, D) > 0);
  assert(proximityFromDistance(10_000, D) < 0.01);
  assert(proximityFromDistance(1, D) < 1);
});

Deno.test("proximity: Pato's 10 km on Home's 15 km circle — 0.40 at the edge, 0.67 at 5 km", () => {
  assertEquals(D, 10);
  assertAlmostEquals(proximityFromDistance(15, D), 0.4, 1e-12);
  assertAlmostEquals(proximityFromDistance(5, D), 2 / 3, 1e-12);
  assertAlmostEquals(proximityFromDistance(2, D), 1 / 1.2, 1e-12);
});

Deno.test("proximity: D is the operator's; a non-positive D reads the default", () => {
  // ½ at 1 km on a 1 km half-distance, at 50 km on a 50 km one.
  assertAlmostEquals(proximityFromDistance(1, 1), 0.5, 1e-12);
  assertAlmostEquals(proximityFromDistance(50, 50), 0.5, 1e-12);
  assertAlmostEquals(proximityFromDistance(D, 0), 0.5, 1e-12);
  assertAlmostEquals(proximityFromDistance(D, Number.NaN), 0.5, 1e-12);
  assertAlmostEquals(proximityFromDistance(D, -3), 0.5, 1e-12);
});

Deno.test("proximity missing data: no anchor abstains at 1; no coordinates is 0", () => {
  assertEquals(proximity({ lat: 1, lng: 1 }, null, 4), 1);
  assertEquals(proximity({ lat: null, lng: null }, { lat: 0, lng: 0 }, 4), 0);
});

Deno.test("popularity: (rating ÷ 5) × reviews ÷ (reviews + K), 0..1 (MESITA-2347)", () => {
  // Half credit at K reviews, at any rating.
  assertAlmostEquals(popularity({ rating: 5, reviewCount: K }, K), 0.5, 1e-12);
  assertAlmostEquals(popularity({ rating: 4.0, reviewCount: K }, K), 0.4, 1e-12);
  // Rating counts linearly: a 3★ place is 60% of a 5★ one at the same volume.
  assertAlmostEquals(
    popularity({ rating: 3, reviewCount: 500 }, K) / popularity({ rating: 5, reviewCount: 500 }, K),
    0.6,
    1e-12,
  );
  // Volume saturates: never 1, and 50,000 reviews are barely above 5,000.
  assert(popularity({ rating: 5, reviewCount: 50_000 }, K) < 1);
  assert(popularity({ rating: 5, reviewCount: 50_000 }, K) - popularity({ rating: 5, reviewCount: 5_000 }, K) < 0.02);
  // Volume still matters: a 5.0 from three people scores below a 4.6 from nine hundred.
  assert(popularity({ rating: 5, reviewCount: 3 }, K) < popularity({ rating: 4.6, reviewCount: 900 }, K));
});

Deno.test("popularity: quality finally outranks raw volume (the reason for MESITA-2347)", () => {
  // Under ln(1 + rating × reviews) a 3.0★ with 100 reviews beat a 4.8★ with 50.
  assert(popularity({ rating: 4.8, reviewCount: 50 }, K) > popularity({ rating: 3.0, reviewCount: 100 }, K));
});

Deno.test("popularity: K is the operator's; a non-positive K reads the default", () => {
  assertAlmostEquals(popularity({ rating: 5, reviewCount: 10 }, 10), 0.5, 1e-12);
  assertAlmostEquals(popularity({ rating: 5, reviewCount: K }, 0), 0.5, 1e-12);
  assertAlmostEquals(popularity({ rating: 5, reviewCount: K }, Number.NaN), 0.5, 1e-12);
});

Deno.test("popularity missing data: no rating or no review count is 0 (no new-place prior)", () => {
  assertEquals(popularity({ rating: null, reviewCount: 300 }, K), 0);
  assertEquals(popularity({ rating: 4.8, reviewCount: null }, K), 0);
  assertEquals(popularity({ rating: 4.8, reviewCount: 0 }, K), 0);
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

// ── MESITA-2338: non-finite inputs and names outside Latin ─────────────────

Deno.test("proximity: an unplaceable distance scores 0, never 1", () => {
  assertEquals(proximityFromDistance(Number.NaN, 10), 0);
  assertEquals(proximityFromDistance(Number.POSITIVE_INFINITY, 10), 0);
  // The point itself is 1 whatever D is.
  assertEquals(proximityFromDistance(0, Number.NaN), 1);
  assertEquals(proximityFromDistance(0, 0), 1);
});

Deno.test("popularity: NaN or infinite numbers score 0, never NaN", () => {
  assertEquals(popularity({ rating: Number.NaN, reviewCount: 100 }, K), 0);
  assertEquals(popularity({ rating: 4.5, reviewCount: Number.POSITIVE_INFINITY }, K), 0);
});

Deno.test("name: letters of every script survive normalization", () => {
  assertEquals(normalizeName("寿司 Kyo!"), "寿司 kyo");
  assertEquals(normalizeName("Кафе Пушкин"), "кафе пушкин");
  assertEquals(normalizeName("Café Niño — Güero!"), "cafe nino guero");
  assertEquals(lexicalNameSimilarity("寿司", "寿司"), 1);
  assert(lexicalNameSimilarity("Кафе", "Кафе Пушкин") >= 0.8);
});

Deno.test("name: other scripts keep their marks, so different names never collide", () => {
  assert(normalizeName("カフェ") !== normalizeName("ガフェ"));
  assert(normalizeName("कमल") !== normalizeName("कमाल"));
  assertEquals(normalizeName("Café"), normalizeName("Cafe"));
  assertEquals(normalizeName("La 1ª Taquería"), "la 1a taqueria");
});
