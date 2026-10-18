// The admin's Discovery bounds and defaults twin the server's (MESITA-2338).
// apps/web-admin cannot import this package (Vercel's root is the app), so
// catalog.ts keeps its own copies; this pins them, so a server clamp and an
// admin field can never disagree on what a value may be.
import { assertEquals } from "jsr:@std/assert@1";
import { DEEP_LIMIT_MAX, DEEP_LIMIT_MIN, DEFAULT_DEEP, SIGNAL_PARAM_BOUNDS } from "./discovery-config.ts";
import {
  POPULARITY_REFERENCE_RATING_DEFAULT,
  POPULARITY_REFERENCE_REVIEWS_DEFAULT,
  PROXIMITY_HALF_DISTANCE_KM_DEFAULT,
} from "./pipeline-signals.ts";

const admin = await Deno.readTextFile(
  new URL("../../../../apps/web-admin/src/app/(app)/filters-config/catalog.ts", import.meta.url),
);

function constant(name: string): number {
  const m = admin.match(new RegExp(`export const ${name} = ([0-9_.]+);`));
  if (!m) throw new Error(`catalog.ts has no ${name}`);
  return Number(m[1].replaceAll("_", ""));
}

Deno.test("Deep box bounds and defaults match the server", () => {
  assertEquals(constant("DEEP_LIMIT_MIN"), DEEP_LIMIT_MIN);
  assertEquals(constant("DEEP_LIMIT_MAX"), DEEP_LIMIT_MAX);
  const m = admin.match(/export const DEFAULT_DEEP: DeepConfig = \{ limit: (\d+), minSimilarity: ([0-9.]+) \};/);
  assertEquals(m ? { limit: Number(m[1]), minSimilarity: Number(m[2]) } : null, DEFAULT_DEEP);
});

Deno.test("Area box bounds and provisional defaults match the server", () => {
  assertEquals(constant("HALF_DISTANCE_KM_MIN"), SIGNAL_PARAM_BOUNDS.halfDistanceKm.min);
  assertEquals(constant("HALF_DISTANCE_KM_MAX"), SIGNAL_PARAM_BOUNDS.halfDistanceKm.max);
  assertEquals(constant("REFERENCE_RATING_MIN"), SIGNAL_PARAM_BOUNDS.referenceRating.min);
  assertEquals(constant("REFERENCE_RATING_MAX"), SIGNAL_PARAM_BOUNDS.referenceRating.max);
  assertEquals(constant("REFERENCE_REVIEWS_MIN"), SIGNAL_PARAM_BOUNDS.referenceReviews.min);
  assertEquals(constant("REFERENCE_REVIEWS_MAX"), SIGNAL_PARAM_BOUNDS.referenceReviews.max);
  assertEquals(admin.includes(`halfDistanceKm: ${PROXIMITY_HALF_DISTANCE_KM_DEFAULT}`), true);
  assertEquals(admin.includes(`referenceRating: ${POPULARITY_REFERENCE_RATING_DEFAULT}`), true);
  assertEquals(admin.includes(`referenceReviews: ${POPULARITY_REFERENCE_REVIEWS_DEFAULT}`), true);
});
