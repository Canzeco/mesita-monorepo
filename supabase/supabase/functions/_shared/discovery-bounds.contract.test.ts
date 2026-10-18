// The admin's Discovery bounds and defaults twin the server's (MESITA-2338).
// apps/web-admin cannot import this package (Vercel's root is the app), so
// catalog.ts keeps its own copies; this pins them, so a server clamp and an
// admin field can never disagree on what a value may be.
import { assertEquals } from "jsr:@std/assert@1";
import { DEEP_LIMIT_MAX, DEEP_LIMIT_MIN, DEFAULT_DEEP, SIGNAL_PARAM_BOUNDS } from "./discovery-config.ts";
import { POPULARITY_HALF_REVIEWS_DEFAULT } from "./pipeline-signals.ts";
import { AREA_WEIGHT_DEFAULT } from "./discovery-config.ts";

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

Deno.test("Area box bounds and defaults match the server (MESITA-2347)", () => {
  assertEquals(constant("HALF_REVIEWS_MIN"), SIGNAL_PARAM_BOUNDS.halfReviews.min);
  assertEquals(constant("HALF_REVIEWS_MAX"), SIGNAL_PARAM_BOUNDS.halfReviews.max);
  assertEquals(constant("AREA_WEIGHT_MIN"), SIGNAL_PARAM_BOUNDS.weight.min);
  assertEquals(constant("AREA_WEIGHT_MAX"), SIGNAL_PARAM_BOUNDS.weight.max);
  const d = admin.match(
    /popularity: \{ halfReviews: ([0-9_]+) \},\s*balance: \{ proximity: (\d+), popularity: (\d+) \}/,
  );
  assertEquals(
    d ? [Number(d[1].replaceAll("_", "")), Number(d[2]), Number(d[3])] : null,
    [POPULARITY_HALF_REVIEWS_DEFAULT, AREA_WEIGHT_DEFAULT, AREA_WEIGHT_DEFAULT],
  );
});
