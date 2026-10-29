// The four Discovery signals (MESITA-2327): formulas and missing-data policy.
import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import {
  descriptionSimilarity,
  popularity,
  POPULARITY_HALF_REVIEWS_DEFAULT,
  proximity,
  PROXIMITY_HALF_KM_DEFAULT,
  proximityFromDistance,
} from "./pipeline-signals.ts";

const K = POPULARITY_HALF_REVIEWS_DEFAULT;
const D = 10;

Deno.test("proximity: 1 ÷ (1 + (d ÷ D)²) — 1 at the point, ½ at D, ⅕ at 2D, never 0 (MESITA-3079)", () => {
  assertEquals(PROXIMITY_HALF_KM_DEFAULT, 10);
  assertEquals(proximityFromDistance(0, D), 1);
  assertAlmostEquals(proximityFromDistance(D / 2, D), 0.8, 1e-12);
  assertAlmostEquals(proximityFromDistance(D, D), 0.5, 1e-12);
  assertAlmostEquals(proximityFromDistance(2 * D, D), 1 / 5, 1e-12);
  const at = (k: number) => proximityFromDistance(k * D, D);
  // Flat near the guest: the first half of D costs less than the second.
  assert(1 - at(0.5) < at(0.5) - at(1));
  // Past D only ratios matter: twice as far is a quarter of the credit, at any D.
  assertAlmostEquals(at(20) / at(10), 0.25, 0.01);
  assertAlmostEquals(proximityFromDistance(200, 1) / proximityFromDistance(100, 1), 0.25, 0.01);
  // A far place is lowered, never cut.
  assert(proximityFromDistance(10_000, D) > 0);
  assert(proximityFromDistance(1, D) < 1);
  // The money case (Pato, 2026-10-28): the best place in the catalog
  // (≈ 1.8× Popularity) 36 km away no longer beats an average one 5 km
  // away. Under the log curve it did.
  assert(1.8 * proximityFromDistance(36, 5) < proximityFromDistance(5, 5));
});

Deno.test("proximity: a non-positive D cannot place a distance", () => {
  assertEquals(proximityFromDistance(0, 0), 1);
  assertEquals(proximityFromDistance(D, 0), 0);
  assertEquals(proximityFromDistance(D, Number.NaN), 0);
  assertEquals(proximityFromDistance(D, -3), 0);
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

Deno.test("description: cosine of the request against the summary; no summary vector cannot judge", () => {
  assertAlmostEquals(descriptionSimilarity([1, 0], [1, 0])!, 1, 1e-12);
  assertEquals(descriptionSimilarity([1, 0], null), null);
  assertEquals(descriptionSimilarity([1, 0, 0], [1, 0]), null);
});

// ── MESITA-2338: non-finite inputs ───────────────────────────────────────

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

