// The admin's Discovery bounds and defaults twin the server's (MESITA-2338).
// apps/web-admin cannot import this package (Vercel's root is the app), so
// catalog.ts keeps its own copies; this pins them, so a server clamp and an
// admin field can never disagree on what a value may be.
import { assertEquals } from "jsr:@std/assert@1";
import {
  DEEP_LIMIT_MAX,
  DEEP_LIMIT_MIN,
  DEFAULT_DEEP,
  MAP_POPULARITY_FLOOR_DEFAULT,
  SIGNAL_PARAM_BOUNDS,
} from "./discovery-config.ts";
import {
  POPULARITY_ROOT_DEFAULT,
  PROXIMITY_EXPONENT_DEFAULT,
  PROXIMITY_HALF_KM_DEFAULT,
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

Deno.test("Catalog box bounds and defaults match the server (the half distance since MESITA-2909; the exponent and the root, MESITA-3083)", () => {
  assertEquals(constant("HALF_KM_MIN"), SIGNAL_PARAM_BOUNDS.halfKm.min);
  assertEquals(constant("HALF_KM_MAX"), SIGNAL_PARAM_BOUNDS.halfKm.max);
  assertEquals(constant("EXPONENT_MIN"), SIGNAL_PARAM_BOUNDS.exponent.min);
  assertEquals(constant("EXPONENT_MAX"), SIGNAL_PARAM_BOUNDS.exponent.max);
  assertEquals(constant("POPULARITY_ROOT_MIN"), SIGNAL_PARAM_BOUNDS.root.min);
  assertEquals(constant("POPULARITY_ROOT_MAX"), SIGNAL_PARAM_BOUNDS.root.max);
  const m = admin.match(
    /const DEFAULT_SIGNAL_PARAMS: SignalParams = \{\s*proximity: \{ halfKm: ([0-9_.]+), exponent: ([0-9_.]+) \},\s*popularity: \{ root: ([0-9_.]+) \},\s*\};/,
  );
  const n = (i: number) => (m ? Number(m[i].replaceAll("_", "")) : null);
  assertEquals(n(1), PROXIMITY_HALF_KM_DEFAULT);
  assertEquals(n(2), PROXIMITY_EXPONENT_DEFAULT);
  assertEquals(n(3), POPULARITY_ROOT_DEFAULT);
});

Deno.test("the Minimum Popularity default matches the server, in the root's units (MESITA-3083)", () => {
  const m = admin.match(/const MAP_POPULARITY_FLOOR_DEFAULT = ([0-9.]+);/);
  assertEquals(m ? Number(m[1]) : null, MAP_POPULARITY_FLOOR_DEFAULT);
});
