import { assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import {
  blendPopularity,
  establishedBase,
  growthTermsFromRows,
  growthWeight,
} from "./review-growth.ts";

const COLD = { kind: "missing" as const, elapsedDays: null, growthBase: null };

Deno.test("cold start is the established base, for every Google exponent the caller applies later", () => {
  assertEquals(establishedBase(4.5, 1000), 4500);
  assertEquals(establishedBase(4, 0), 0);
  assertEquals(establishedBase(null, 50), 0);
  assertEquals(establishedBase(4, null), 0);
  assertEquals(blendPopularity(4500, undefined, 0.5), 4500);
  assertEquals(blendPopularity(4500, COLD, 0.5), 4500);
  assertEquals(blendPopularity(4500, { kind: "short", elapsedDays: 3, growthBase: 9000 }, 0.5), 4500);
  assertEquals(blendPopularity(4500, { kind: "fallback", elapsedDays: 40, growthBase: null }, 0.5), 4500);
});

Deno.test("growth weight: 0 under 7 days, 0.20 at 7, the cap at 30, linear between", () => {
  assertEquals(growthWeight(6.9, 0.5, "grow"), 0);
  assertAlmostEquals(growthWeight(7, 0.5, "grow"), 0.2, 1e-12);
  // 7 + 11.5 days is the midpoint of the 23-day ramp: 0.20 + 0.5 × 0.30.
  assertAlmostEquals(growthWeight(18.5, 0.5, "grow"), 0.35, 1e-12);
  assertAlmostEquals(growthWeight(30, 0.5, "flat"), 0.5, 1e-12);
  assertAlmostEquals(growthWeight(90, 0.5, "grow"), 0.5, 1e-12);
  // The experiment raises the cap. Day 7 stays 0.20; day 30 becomes 0.80.
  assertAlmostEquals(growthWeight(7, 0.8, "grow"), 0.2, 1e-12);
  assertAlmostEquals(growthWeight(30, 0.8, "grow"), 0.8, 1e-12);
  assertEquals(growthWeight(30, 0.5, "missing"), 0);
  assertEquals(growthWeight(30, 0.5, "fallback"), 0);
});

Deno.test("a watched flat place mixes in a zero growth base; a growing place mixes its base", () => {
  const flat = blendPopularity(1000, { kind: "flat", elapsedDays: 30, growthBase: 0 }, 0.5);
  assertAlmostEquals(flat, 500, 1e-9);
  const grew = blendPopularity(1000, { kind: "grow", elapsedDays: 30, growthBase: 3000 }, 0.5);
  assertAlmostEquals(grew, 2000, 1e-9);
  // Day 7 is 80% established.
  const week = blendPopularity(1000, { kind: "grow", elapsedDays: 7, growthBase: 3000 }, 0.5);
  assertAlmostEquals(week, 0.8 * 1000 + 0.2 * 3000, 1e-9);
});

Deno.test("growth rows: a bad kind is dropped, numbers pass through", () => {
  const map = growthTermsFromRows([
    { place_id: "a", kind: "grow", elapsed_days: 12, growth_base: 40 },
    { place_id: "b", kind: "nope", elapsed_days: 12, growth_base: 1 },
    { place_id: 3, kind: "flat", elapsed_days: 10, growth_base: 0 },
  ]);
  assertEquals(map.size, 1);
  assertEquals(map.get("a"), { kind: "grow", elapsedDays: 12, growthBase: 40 });
});
