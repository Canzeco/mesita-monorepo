// The four Discovery signals (MESITA-2327): formulas and missing-data policy.
import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import {
  clearsAdFloor,
  clearsPopularityFloor,
  cutAndShuffle,
  googlePopularity,
  mergeLanes,
  premierBoost,
  rankModeForChip,
  recipeScore,
  descriptionSimilarity,
  popularity,
  POPULARITY_HALF_REVIEWS_DEFAULT,
  POPULARITY_ROOT_DEFAULT,
  proximity,
  PROXIMITY_EXPONENT_DEFAULT,
  PROXIMITY_HALF_KM_DEFAULT,
  proximityFromDistance,
  rootPopularity,
  shuffleByRank,
} from "./pipeline-signals.ts";

const K = POPULARITY_HALF_REVIEWS_DEFAULT;
const D = 10;

Deno.test("proximity: 1 ÷ (1 + d ÷ D) — 1 at the point, ½ at D, ⅓ at 2D, never 0 (MESITA-3015)", () => {
  assertEquals(PROXIMITY_HALF_KM_DEFAULT, 1);
  assertEquals(PROXIMITY_EXPONENT_DEFAULT, 1);
  assertEquals(proximityFromDistance(0, D), 1);
  assertAlmostEquals(proximityFromDistance(D, D), 0.5, 1e-12);
  assertAlmostEquals(proximityFromDistance(2 * D, D), 1 / 3, 1e-12);
  const at = (k: number) => proximityFromDistance(k * D, D);
  // Falls fast near the guest, ever slower after.
  assert(1 - at(0.5) > at(1) - at(2));
  assert(at(1) - at(2) > at(2) - at(4));
  // Past D only ratios matter: twice as far is half the credit, at any D.
  assertAlmostEquals(at(20) / at(10), 0.5, 0.03);
  assertAlmostEquals(proximityFromDistance(200, 1) / proximityFromDistance(100, 1), 0.5, 0.01);
  // A far place is lowered, never cut.
  assert(proximityFromDistance(10_000, D) > 0);
  assert(proximityFromDistance(1, D) < 1);
  // The money case (Pato, 2026-10-28): the best place in the catalog
  // (≈ 1.8× Popularity under ln) 36 km away no longer beats an average one
  // 5 km away. Under the log curve it did.
  assert(1.8 * proximityFromDistance(36, 5) < proximityFromDistance(5, 5));
});

Deno.test("proximity: the exponent shapes the curve past D, ½ at D whatever it is (MESITA-3083)", () => {
  // ½ at D for every exponent.
  for (const e of [0.5, 1, 1.5, 2, 4]) assertAlmostEquals(proximityFromDistance(D, D, e), 0.5, 1e-12, `e = ${e}`);
  // At 2D: ⅓ at e = 1, ⅕ at e = 2, and 1 ÷ (1 + √2) at e = 0.5.
  assertAlmostEquals(proximityFromDistance(2 * D, D, 2), 0.2, 1e-12);
  assertAlmostEquals(proximityFromDistance(2 * D, D, 0.5), 1 / (1 + Math.SQRT2), 1e-12);
  // Over 1 the curve is flat inside D and a cliff past it; under 1 the far keeps its credit.
  assert(proximityFromDistance(D / 2, D, 2) > proximityFromDistance(D / 2, D, 1));
  assert(proximityFromDistance(10 * D, D, 2) < proximityFromDistance(10 * D, D, 1));
  assert(proximityFromDistance(10 * D, D, 0.5) > proximityFromDistance(10 * D, D, 1));
  // Past D the ratio is (d₂ ÷ d₁)^e: twice as far is a quarter at e = 2.
  assertAlmostEquals(proximityFromDistance(40 * D, D, 2) / proximityFromDistance(20 * D, D, 2), 0.25, 0.01);
  // The default reads 1; an exponent that is not a positive number reads it too.
  assertEquals(proximityFromDistance(2 * D, D), proximityFromDistance(2 * D, D, 1));
  assertEquals(proximityFromDistance(2 * D, D, 0), proximityFromDistance(2 * D, D, 1));
  assertEquals(proximityFromDistance(2 * D, D, Number.NaN), proximityFromDistance(2 * D, D, 1));
  assertEquals(proximityFromDistance(0, D, 3), 1);
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
  // The exponent reaches the placed case.
  const near = { lat: 0, lng: 0.018 }; // ≈ 2 km east of the anchor
  assertAlmostEquals(proximity(near, { lat: 0, lng: 0 }, 1, 2), 1 / (1 + 4), 0.01);
});

Deno.test("Popularity: (1 + reviews × stars)^root, the cube root by default, never normalized (MESITA-3083)", () => {
  assertEquals(POPULARITY_ROOT_DEFAULT, 0.33);
  // 4.6★ × 1,000 ≈ 16.2, 4.0★ × 30 ≈ 4.9: above 1 and never clamped.
  assertAlmostEquals(rootPopularity({ rating: 4.6, reviewCount: 1000 }), Math.pow(4601, 0.33), 1e-12);
  assertAlmostEquals(rootPopularity({ rating: 4.0, reviewCount: 30 }), Math.pow(121, 0.33), 1e-12);
  assert(rootPopularity({ rating: 4.6, reviewCount: 1000 }) > 16);
  // At exactly the cube root 8× the reviews doubles the factor, 1,000× is 10×.
  const cube = (n: number) => rootPopularity({ rating: 4, reviewCount: n }, 1 / 3);
  assertAlmostEquals(cube(8000) / cube(1000), 2, 0.01);
  assertAlmostEquals(cube(10_000) / cube(10), 10, 0.1);
  // So a ×2 plan is worth 8× the reviews and a ×5 plan 125×.
  assertAlmostEquals(2 * cube(100), cube(800), 0.05);
  assertAlmostEquals(5 * cube(100), cube(12_500), 0.3);
  // The root is the operator's: the square root makes reviews count more.
  assert(rootPopularity({ rating: 4, reviewCount: 1000 }, 0.5) > rootPopularity({ rating: 4, reviewCount: 1000 }, 0.33));
  // Stars count: more reviews at the same stars always rank higher, and so do more stars.
  assert(rootPopularity({ rating: 4.2, reviewCount: 3000 }) > rootPopularity({ rating: 4.9, reviewCount: 30 }));
  assert(rootPopularity({ rating: 4.8, reviewCount: 100 }) > rootPopularity({ rating: 3.0, reviewCount: 100 }));
  // A place with no reviews is a factor of 1, never 0: distance and the plan still rank it.
  assertEquals(rootPopularity({ rating: 4.8, reviewCount: 0 }), 1);
  // A root that is not a positive number reads the default.
  assertEquals(rootPopularity({ rating: 4, reviewCount: 100 }, 0), rootPopularity({ rating: 4, reviewCount: 100 }));
  assertEquals(rootPopularity({ rating: 4, reviewCount: 100 }, Number.NaN), rootPopularity({ rating: 4, reviewCount: 100 }));
});

Deno.test("Popularity missing data: no rating or no review count is 0; NaN or infinite numbers too", () => {
  assertEquals(rootPopularity({ rating: null, reviewCount: 300 }), 0);
  assertEquals(rootPopularity({ rating: 4.8, reviewCount: null }), 0);
  assertEquals(rootPopularity({ rating: Number.NaN, reviewCount: 100 }), 0);
  assertEquals(rootPopularity({ rating: 4.5, reviewCount: Number.POSITIVE_INFINITY }), 0);
});

Deno.test("the Popularity floor reads the root's units: 2.7 ≈ 4★ × 5 reviews at the cube root (MESITA-2714, MESITA-3083)", () => {
  assertEquals(clearsPopularityFloor({ rating: 4, reviewCount: 5 }, 2.7), true);
  assertEquals(clearsPopularityFloor({ rating: 4, reviewCount: 4 }, 2.7), false);
  assertEquals(clearsPopularityFloor({ rating: null, reviewCount: null }, 2.7), false);
  // Off at 0 or less.
  assertEquals(clearsPopularityFloor({ rating: null, reviewCount: null }, 0), true);
  // The root moves the reading: at the square root 4★ × 4 reviews is 4.1, over 2.7.
  assertEquals(clearsPopularityFloor({ rating: 4, reviewCount: 4 }, 2.7, 0.5), true);
});

Deno.test("popularity (0..1, the Map floor's): (rating ÷ 5) × reviews ÷ (reviews + K) (MESITA-2347)", () => {
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
  // Quality outranks raw volume (the reason for MESITA-2347).
  assert(popularity({ rating: 4.8, reviewCount: 50 }, K) > popularity({ rating: 3.0, reviewCount: 100 }, K));
});

Deno.test("popularity (0..1): K is the caller's; a non-positive K reads the constant 100 (the knob retired, MESITA-3083)", () => {
  assertEquals(K, 100);
  assertAlmostEquals(popularity({ rating: 5, reviewCount: 10 }, 10), 0.5, 1e-12);
  assertAlmostEquals(popularity({ rating: 5, reviewCount: K }, 0), 0.5, 1e-12);
  assertAlmostEquals(popularity({ rating: 5, reviewCount: K }, Number.NaN), 0.5, 1e-12);
});

Deno.test("popularity (0..1) missing data: no rating or no review count is 0 (no new-place prior)", () => {
  assertEquals(popularity({ rating: null, reviewCount: 300 }, K), 0);
  assertEquals(popularity({ rating: 4.8, reviewCount: null }, K), 0);
  assertEquals(popularity({ rating: 4.8, reviewCount: 0 }, K), 0);
  assertEquals(popularity({ rating: Number.NaN, reviewCount: 100 }, K), 0);
  assertEquals(popularity({ rating: 4.5, reviewCount: Number.POSITIVE_INFINITY }, K), 0);
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

// ── MESITA-4153: stars weight and the shuffle after the sort ───────────────

Deno.test("the stars weight lifts the better-rated place; 0 is today's Popularity", () => {
  const a = { rating: 4.9, reviewCount: 1000 };
  const b = { rating: 4.4, reviewCount: 1000 };
  assertEquals(rootPopularity(a, 0.33, 0), rootPopularity(a, 0.33));
  const ratio = rootPopularity(a, 0.33, 6) / rootPopularity(b, 0.33, 6);
  assert(ratio > 1.9 && ratio < 2.1, `4.9★ vs 4.4★ at k 6 was ×${ratio}`);
});

Deno.test("shuffleByRank: temperature 0 keeps the sort, any temperature keeps every item", () => {
  const order = Array.from({ length: 50 }, (_, i) => i);
  assertEquals(shuffleByRank(order, 0), order);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const out = shuffleByRank(order, 1, rnd);
  assertEquals([...out].sort((x, y) => x - y), order);
  // Low temperature: the head barely moves on average.
  let moved = 0;
  for (let t = 0; t < 200; t++) moved += shuffleByRank(order, 0.3, rnd).indexOf(0);
  assert(moved / 200 < 2, `rank 1 drifted to ${moved / 200} on average at T 0.3`);
});

// ── MESITA-4454: one formula, two lanes, three modes ────────────────────────
//
// The same six places and recipe rows as catalog_rank_lanes.test.sql (M-e):
// Organic {1 km, 2, 2, 0.5, 0}, Inorganic {1 km, 2, 2, 0.5, 1}, so
// Popularity = stars × √reviews and Proximity = 1 ÷ (1 + km²).

const ORG = { halfKm: 1, distanceExp: 2, starsExp: 2, googleExp: 0.5, premierExp: 0 };
const INORG = { ...ORG, premierExp: 1 };

Deno.test("v2 score: Proximity × (stars^StarsExp × reviews)^GoogleExp × premierFactor^PremierExp, by hand", () => {
  // A: 4.5★ × 1000 at the point: 4.5 × √1000 ≈ 142.30.
  assertAlmostEquals(recipeScore({ rating: 4.5, reviewCount: 1000 }, 0, true, 1, ORG).final, 142.302, 1e-3);
  // D: 4.0★ × 100, 2X, 1 km: Organic 0.5 × 40 = 20; Inorganic × 2 = 40.
  const d = recipeScore({ rating: 4, reviewCount: 100 }, 1, true, 2, ORG);
  assertEquals([d.proximity, d.popularity, d.premierFactor, d.premierBoost, d.final], [0.5, 40, 2, 1, 20]);
  assertAlmostEquals(recipeScore({ rating: 4, reviewCount: 100 }, 1, true, 2, INORG).final, 40, 1e-9);
  // E: 4.8★ × 500, 5X, 2 km: Organic 0.2 × 107.33 ≈ 21.47; Inorganic × 5 ≈ 107.33.
  assertAlmostEquals(recipeScore({ rating: 4.8, reviewCount: 500 }, 2, true, 5, ORG).final, 21.466, 1e-3);
  assertAlmostEquals(recipeScore({ rating: 4.8, reviewCount: 500 }, 2, true, 5, INORG).final, 107.331, 1e-3);
  // F: 2X at 50 km is under the 0.2 floor (0.0004 × 2); D and E clear it.
  const fProx = recipeScore({ rating: 4.6, reviewCount: 300 }, 50, true, 2, INORG).proximity;
  assertEquals(clearsAdFloor(fProx, 2, 0.2), false);
  assertEquals(clearsAdFloor(0.5, 2, 0.2), true);
  assertEquals(clearsAdFloor(0.2, 5, 0.2), true);
  // No anchor: Proximity abstains (null, counted as 1), every Premier place clears.
  const none = recipeScore({ rating: 4, reviewCount: 100 }, null, false, 2, INORG);
  assertEquals([none.proximity, none.final], [null, 80]);
  assertEquals(clearsAdFloor(none.proximity, 2, 0.2), true);
  // A Map row has no Proximity even with an anchor.
  assertEquals(recipeScore({ rating: 4, reviewCount: 100 }, 9, true, 1, { ...ORG, halfKm: null, distanceExp: null }).final, 40);
  // Measured from an anchor without coordinates: Proximity 0.
  assertEquals(recipeScore({ rating: 4, reviewCount: 100 }, null, true, 1, ORG).final, 0);
});

Deno.test("v2 score: 0 reviews or no stars scores 0; Premier exponent 0 ignores the plan", () => {
  assertEquals(googlePopularity({ rating: 4, reviewCount: 0 }, 2, 0.33), 0);
  assertEquals(googlePopularity({ rating: null, reviewCount: 50 }, 2, 0.33), 0);
  assertEquals(googlePopularity({ rating: 4, reviewCount: null }, 2, 0.33), 0);
  assertEquals(recipeScore({ rating: 4, reviewCount: 0 }, 0, true, 5, INORG).final, 0);
  assertEquals(premierBoost(5, 0), 1);
  assertEquals(premierBoost(2, 1), 2);
  assertAlmostEquals(premierBoost(5, 0.5), Math.sqrt(5), 1e-12);
  assertEquals(
    recipeScore({ rating: 4, reviewCount: 100 }, 1, true, 5, ORG).final,
    recipeScore({ rating: 4, reviewCount: 100 }, 1, true, 1, ORG).final,
  );
  // Stars count through StarsExp: at 0 only reviews do.
  assertAlmostEquals(googlePopularity({ rating: 3, reviewCount: 100 }, 0, 1), 100, 1e-12);
  assertAlmostEquals(googlePopularity({ rating: 3, reviewCount: 100 }, 2, 1), 900, 1e-12);
});

Deno.test("mergeLanes: one ad after every adEvery organic places; dupes skipped; empty slots dropped; 0 = no ads", () => {
  const organic = ["o1", "o2", "o3", "o4", "o5", "o6"];
  assertEquals(mergeLanes(organic, ["a1", "a2"], 1), {
    order: ["o1", "a1", "o2", "a2", "o3", "o4", "o5", "o6"],
    adIds: ["a1", "a2"],
  });
  assertEquals(mergeLanes(organic, ["a1", "a2", "a3"], 3), {
    order: ["o1", "o2", "o3", "a1", "o4", "o5", "o6", "a2"],
    adIds: ["a1", "a2"],
  });
  assertEquals(mergeLanes(organic, ["a1"], 0), { order: organic, adIds: [] });
  // A Premier place is in both lanes: shown once, and only in an ad slot it wears "Ad".
  const both = mergeLanes(["o1", "p1", "o2", "p2"], ["p2", "p1"], 1);
  assertEquals(both.order, ["o1", "p2", "p1", "o2"]);
  assertEquals(both.adIds, ["p2"]);
  assertEquals(new Set(both.order).size, both.order.length);
  // An ad already shown organically is skipped; the slot takes the next.
  assertEquals(mergeLanes(["o1", "o2", "o3"], ["o1", "a1"], 1).adIds, ["a1"]);
  // Empty lanes.
  assertEquals(mergeLanes(organic, [], 1), { order: organic, adIds: [] });
  assertEquals(mergeLanes([], ["a1"], 1), { order: [], adIds: [] });
  // Duplicates inside the organic lane collapse.
  assertEquals(mergeLanes(["o1", "o1", "o2"], [], 1).order, ["o1", "o2"]);
});

Deno.test("cutAndShuffle: keyed by (seed, id); T 0 is the identity; seed 0 valid; the tail is exact", () => {
  const order = Array.from({ length: 60 }, (_, i) => `id${String(i).padStart(2, "0")}`);
  assertEquals(cutAndShuffle(order, 20, 0, 123), order);
  const a = cutAndShuffle(order, 20, 1, 123);
  assertEquals(cutAndShuffle(order, 20, 1, 123), a);
  assertEquals([...a.slice(0, 20)].sort(), order.slice(0, 20));
  assertEquals(a.slice(20), order.slice(20));
  assert(a.slice(0, 20).join() !== order.slice(0, 20).join(), "T 1 kept the first page exactly");
  assert(cutAndShuffle(order, 20, 1, 124).join() !== a.join(), "another seed drew the same page");
  const zero = cutAndShuffle(order, 20, 1, 0);
  assertEquals(cutAndShuffle(order, 20, 1, 0), zero);
  assertEquals([...zero.slice(0, 20)].sort(), order.slice(0, 20));
  // One place entering the page shifts the rest only locally: the places
  // ranked above it keep their relative order (their keys are unchanged).
  const entered = [...order.slice(0, 15), "new", ...order.slice(15)];
  const b = cutAndShuffle(entered, 21, 1, 123);
  const above = new Set(order.slice(0, 15));
  assertEquals(
    b.filter((id) => above.has(id)),
    cutAndShuffle(order, 20, 1, 123).filter((id) => above.has(id)),
  );
  // Low temperature: the head barely moves on average across seeds.
  let moved = 0;
  for (let seed = 0; seed < 200; seed++) moved += cutAndShuffle(order, 20, 0.3, seed).indexOf("id00");
  assert(moved / 200 < 2, `rank 1 drifted to ${moved / 200} on average at T 0.3`);
});

Deno.test("rankModeForChip: near is nearby, all is popular, any family key is family", () => {
  assertEquals(rankModeForChip("near"), "nearby");
  assertEquals(rankModeForChip("all"), "popular");
  assertEquals(rankModeForChip("tacos"), "family");
  assertEquals(rankModeForChip("coffee"), "family");
});
