// The admin's Discovery bounds and defaults twin the server's (MESITA-2338).
// apps/web-admin cannot import this package (Vercel's root is the app), so
// catalog.ts keeps its own copies; this pins them, so a server clamp and an
// admin field can never disagree on what a value may be.
import { assertEquals } from "jsr:@std/assert@1";
import {
  DEEP_LIMIT_MAX,
  DEEP_LIMIT_MIN,
  DEFAULT_DEEP,
  NAME_POPULARITY_FLOOR_DEFAULT,
  NAME_POPULARITY_FLOOR_MAX,
  NAME_POPULARITY_FLOOR_MIN,
  SIGNAL_PARAM_BOUNDS,
  DEFAULT_SIGNAL_PARAMS,
  DEFAULT_MIX,
  DEFAULT_RECIPES,
  MIX_BOUNDS,
  RECIPE_BOUNDS,
  RECIPE_ROWS,
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
    /const DEFAULT_SIGNAL_PARAMS: SignalParams = \{\s*proximity: \{ halfKm: ([0-9_.]+), exponent: ([0-9_.]+) \},\s*popularity: \{ root: ([0-9_.]+), starsPower: ([0-9_.]+) \},\s*shuffle: \{ temperature: ([0-9_.]+) \},\s*recipes: DEFAULT_RECIPES,\s*mix: DEFAULT_MIX,\s*\};/,
  );
  const n = (i: number) => (m ? Number(m[i].replaceAll("_", "")) : null);
  assertEquals(n(1), PROXIMITY_HALF_KM_DEFAULT);
  assertEquals(n(2), PROXIMITY_EXPONENT_DEFAULT);
  assertEquals(n(3), POPULARITY_ROOT_DEFAULT);
  // MESITA-4153: the stars weight and the temperature (the repeat penalty
  // went with MESITA-4463).
  assertEquals(n(4), DEFAULT_SIGNAL_PARAMS.popularity.starsPower);
  assertEquals(n(5), DEFAULT_SIGNAL_PARAMS.shuffle.temperature);
});

Deno.test("the Minimum Popularity default matches the server, in the root's units (MESITA-3083)", () => {
  // On name since MESITA-3086.
  const m = admin.match(/const NAME_POPULARITY_FLOOR_DEFAULT = ([0-9.]+);/);
  assertEquals(m ? Number(m[1]) : null, NAME_POPULARITY_FLOOR_DEFAULT);
  assertEquals(constant("NAME_POPULARITY_FLOOR_MIN"), NAME_POPULARITY_FLOOR_MIN);
  assertEquals(constant("NAME_POPULARITY_FLOOR_MAX"), NAME_POPULARITY_FLOOR_MAX);
  // The Map's own root default twins the server's.
  assertEquals(/popularityRoot: 0\.33,/.test(admin), true);
});

// MESITA-4454: the Ranking and Mixing cards' bounds and the recipe table.
Deno.test("Ranking and Mixing bounds, the recipe table and the mix defaults match the server (MESITA-4454)", () => {
  // halfKm and distanceExp reuse the Proximity constants pinned above.
  for (const [name, b] of [
    ["GOOGLE_EXP", RECIPE_BOUNDS.googleExp],
    ["FOURSQUARE_FACTOR", RECIPE_BOUNDS.foursquareFactor],
    ["FOURSQUARE_EXPONENT", RECIPE_BOUNDS.foursquareExponent],
    ["PREMIER_EXP", RECIPE_BOUNDS.premierExp],
    ["LANE_BATCH", RECIPE_BOUNDS.batch],
    ["MIX_TEMPERATURE", MIX_BOUNDS.temperature],
    ["AD_EVERY", MIX_BOUNDS.adEvery],
    ["PLAN_FACTOR", MIX_BOUNDS.proFactor],
    ["PLAN_FACTOR", MIX_BOUNDS.maxFactor],
    ["GROWTH_WEIGHT_CAP", MIX_BOUNDS.growthWeightCap],
  ] as const) {
    assertEquals(constant(`${name}_MIN`), b.min, name);
    assertEquals(constant(`${name}_MAX`), b.max, name);
  }
  assertEquals(RECIPE_BOUNDS.halfKm.min, constant("HALF_KM_MIN"));
  assertEquals(RECIPE_BOUNDS.distanceExp.max, constant("EXPONENT_MAX"));
  // Each bound's decimals, read from the admin's RECIPE_BOUNDS / MIX_BOUNDS.
  const decimals = (block: string, key: string) => {
    const body = admin.match(new RegExp(`export const ${block} = \\{([\\s\\S]*?)\\} as const;`));
    const m = body?.[1].match(new RegExp(`${key}: \\{[^}]*decimals: (\\d+) \\}`));
    return m ? Number(m[1]) : null;
  };
  for (const [key, b] of Object.entries(RECIPE_BOUNDS)) assertEquals(decimals("RECIPE_BOUNDS", key), b.decimals, key);
  for (const [key, b] of Object.entries(MIX_BOUNDS)) assertEquals(decimals("MIX_BOUNDS", key), b.decimals, key);
  // The recipe table, row by row, and the mix.
  const num = (v: string) => (v === "null" ? null : Number(v));
  for (const row of RECIPE_ROWS) {
    const m = admin.match(
      new RegExp(
        `  ${row}: \\{ halfKm: (null|[0-9.]+), distanceExp: (null|[0-9.]+), googleExp: ([0-9.]+), foursquareFactor: ([0-9.]+), foursquareExponent: ([0-9.]+), premierExp: ([0-9.]+), batch: (null|[0-9]+) \\},`,
      ),
    );
    assertEquals(
      m ? {
        halfKm: num(m[1]),
        distanceExp: num(m[2]),
        googleExp: num(m[3]),
        foursquareFactor: num(m[4]),
        foursquareExponent: num(m[5]),
        premierExp: num(m[6]),
        batch: num(m[7]),
      } : null,
      { ...DEFAULT_RECIPES[row], batch: DEFAULT_RECIPES[row].batch ?? null },
      row,
    );
  }
  const mix = admin.match(
    /export const DEFAULT_MIX: MixParams = \{\s*temperature: \{ nearby: ([0-9.]+), family: ([0-9.]+), popular: ([0-9.]+) \},\s*adEvery: ([0-9]+),\s*proFactor: ([0-9.]+),\s*maxFactor: ([0-9.]+),\s*growthWeightCap: ([0-9.]+),\s*\};/,
  );
  assertEquals(
    mix
      ? {
        temperature: { nearby: Number(mix[1]), family: Number(mix[2]), popular: Number(mix[3]) },
        adEvery: Number(mix[4]),
        proFactor: Number(mix[5]),
        maxFactor: Number(mix[6]),
        growthWeightCap: Number(mix[7]),
      }
      : null,
    DEFAULT_MIX,
  );
});
