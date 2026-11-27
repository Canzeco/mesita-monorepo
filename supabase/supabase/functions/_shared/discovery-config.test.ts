// MESITA-2328 — the Swipe deck and the seven-signal library retired, and the
// blob keys only they read went with them: `weights`, `weightsByMode`,
// `engines`, the `swipe` slice and the deck's numbers on `params`.
// MESITA-2337 — list-places' listed lanes retired, and `filters` with them.
//
// Both normalizers rebuild the blob key by key, so a retired key is dropped
// on the next save. The two halves of that promise are pinned here: the live
// blob still loads with every live value intact, and the admin twin
// (`coerceConfig` in web-admin's catalog.ts) carries the same keys, so a
// whole-blob Save from the console can neither resurrect a retired key nor
// reset a live one to its default.

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  DEFAULT_MIX,
  DEFAULT_RECIPES,
  NO_SCREEN_RADIUS_KM,
  DISCOVERY_DEFAULTS,
  normalizeDiscoveryConfig,
  normalizeMapConfig,
  normalizeMix,
  premierFactors,
  normalizeRecipes,
  normalizeSignalParams,
  PREMIER_YEARLY_CENTS_MAX,
  PREMIER_YEARLY_CENTS_MIN,
  SIGNAL_PARAM_BOUNDS,
} from "./discovery-config.ts";
import { PREMIER_YEARLY_CENTS } from "./boost.ts";

const CATALOG_SRC = Deno.readTextFileSync(
  new URL(
    "../../../../apps/web-admin/src/app/(app)/filters-config/catalog.ts",
    import.meta.url,
  ),
);

/** `app_config.discovery_config` as stored on 2026-10-18, before MESITA-2328. */
const LIVE_BLOB_2026_10_18 = {
  map: {
    supers: { restaurants: true, cafes_bakeries: true, bars_nightlife: true },
    pinCount: 60,
    minRating: 0,
    googleFill: true,
    googlePull: 20,
    minReviews: 0,
    reloadMinKm: 0.25,
    reloadMinSec: 1,
    minPopularity: 0,
  },
  swipe: { savedAt: null, radiusKm: 5, minReviews: 1, closingBufferMin: 30 },
  params: {
    name: {},
    timing: {
      dawn: 0.55,
      dead: 0.25,
      late: 0.5,
      midday: 1,
      evening: 1,
      breakfast: 0.8,
      openShare: 0.7,
      closedFloor: 0.2,
    },
    category: { miss: 0.1, exact: 1, family: 0.55 },
    proximity: { maxKm: 25, kneeKm: 1, missingGeo: 0.35 },
    popularity: { confidence: 60, floorRating: 3, priorRating: 4.2 },
    randomness: {},
  },
  catalog: {
    ranking: { name: 0 },
    seedCount: 8,
    minSeedPlaces: 2,
    placesPerRail: 8,
    generatedCount: 8,
  },
  engines: { swipe: { ranked: true } },
  filters: { minRating: 0, minReviews: 0, requireReady: true, maxDistanceKm: 0 },
  general: { minReviews: 0, requireActive: true },
  weights: {
    name: 1,
    timing: 1,
    category: 1,
    proximity: 1,
    popularity: 1,
    randomness: 0.35,
    mesita_level: 1,
  },
  chat: { prompt: "Be Memo." },
};

// The rails engine's `catalog` section retired with it (MESITA-2923).
// `premier` joined with MESITA-3043 (Premier's prices).
const LIVE_KEYS = ["chat", "deep", "general", "map", "name", "params", "premier", "social"];
const RETIRED_KEYS = ["weights", "weightsByMode", "engines", "swipe", "filters", "catalog"];

Deno.test("the live blob loads: the retired keys drop, every live value stands", () => {
  const cfg = normalizeDiscoveryConfig(LIVE_BLOB_2026_10_18);
  assertEquals(Object.keys(cfg).sort(), LIVE_KEYS);
  for (const dead of RETIRED_KEYS) {
    assertEquals(dead in cfg, false, dead);
  }
  // `general.minReviews` is retired (MESITA-2702): the one floor is map's.
  // `showScores` (MESITA-4757) postdates the blob: its default, on.
  assertEquals(cfg.general, { requireActive: true, showScores: true });
  // `pinCount`, `supers`, the reload km/sec pair and `googleFill` are
  // dropped and seed nothing (MESITA-2687, MESITA-2703); the four source
  // switches are gone (MESITA-2872, MESITA-2909).
  // The typed rebuild of `map` carries none of them; the blob keeps them
  // until a migration deletes them (H-2, MESITA-4454).
  const map = normalizeMapConfig(LIVE_BLOB_2026_10_18.map);
  assertEquals("mesitaPopular" in map || "mesitaClosest" in map, false);
  for (
    const dead of ["pinCount", "supers", "reloadMinKm", "reloadMinSec", "googleFill", "googlePull", "googlePopular", "googleClosest"]
  ) {
    assertEquals(dead in map, false, dead);
  }
  assertEquals(cfg.chat.prompt, "Be Memo.");
  // The typed params arrive at their defaults because the live blob never
  // stored them; the deck's bags are not typed (the blob keeps them, H-2).
  assertEquals(normalizeSignalParams(LIVE_BLOB_2026_10_18.params), DISCOVERY_DEFAULTS.params);
  assertEquals(cfg.params.recipes, DEFAULT_RECIPES);
});

Deno.test("an unrelated Save does not resurrect a retired key", () => {
  // The save path round-trips the whole blob through this normalizer.
  const first = normalizeDiscoveryConfig(LIVE_BLOB_2026_10_18);
  const afterSave = normalizeDiscoveryConfig({ ...first, chat: { prompt: "after" } });
  for (const dead of RETIRED_KEYS) {
    assertEquals(dead in afterSave, false, dead);
  }
  assertEquals(afterSave.chat.prompt, "after");
});

Deno.test("garbage never throws: loadDiscoveryConfig would swallow it into defaults", () => {
  for (const raw of [null, undefined, "x", 3, [], { params: "x", filters: [], map: null }]) {
    const cfg = normalizeDiscoveryConfig(raw);
    assertEquals(Object.keys(cfg).sort(), LIVE_KEYS);
  }
});

// ── The deck itself ──────────────────────────────────────────────────────────

Deno.test("the deck's EF and library are gone", async () => {
  const exists = (rel: string) => {
    try {
      Deno.statSync(new URL(rel, import.meta.url));
      return true;
    } catch {
      return false;
    }
  };
  assertEquals(exists("../consumer-web-recommend-swipe/"), false);
  for (const lib of ["signals", "blend", "swipe", "predicates", "matrix", "place"]) {
    assertEquals(exists(`./discovery-${lib}.ts`), false, `discovery-${lib}.ts is back`);
  }
  const toml = await Deno.readTextFile(new URL("../../config.toml", import.meta.url));
  assertEquals(toml.includes("[functions.consumer-web-recommend-swipe]"), false);
});

// ── The admin twin, in lockstep ─────────────────────────────────────────────
//
// catalog.ts cannot be imported here (its `@/` alias is Next's), so these
// read its source. A whole-blob Save sends exactly what `coerceConfig`
// rebuilt: a key it forgets is reset to its default on the server, and a key
// it keeps that the server dropped is dropped again, silently, every Save.

function adminConfigKeys(): string[] {
  const block = CATALOG_SRC.match(/export type DiscoveryConfig = \{\n([\s\S]*?)\n\};/);
  assert(block, "could not find `export type DiscoveryConfig` in catalog.ts");
  return [...block[1].matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]).sort();
}

Deno.test("both normalizers carry the same top-level keys", () => {
  assertEquals(adminConfigKeys(), Object.keys(DISCOVERY_DEFAULTS).sort());
  assertEquals(Object.keys(DISCOVERY_DEFAULTS).sort(), LIVE_KEYS);
});

Deno.test("the admin twin rebuilds none of the retired keys", () => {
  // Code only: the file's own comments name what retired, on purpose.
  const code = CATALOG_SRC
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
  for (
    const dead of [
      "weights",
      "weightsByMode",
      "engines",
      "swipe",
      "filters",
      "DiscoveryFilters",
      "WEIGHTED_MODE_KEYS",
      "WIRED_ENGINE_KEYS",
      "SIGNAL_KEYS",
    ]
  ) {
    assertEquals(new RegExp(`\\b${dead}\\b`).test(code), false, `catalog.ts still names ${dead}`);
  }
});

Deno.test("the admin twin mirrors the signal params' bounds", () => {
  const constant = (name: string) => {
    const m = CATALOG_SRC.match(new RegExp(`export const ${name} = ([0-9_.]+);`));
    assert(m, `catalog.ts has no ${name}`);
    return Number(m[1].replaceAll("_", ""));
  };
  assertEquals(constant("HALF_KM_MIN"), SIGNAL_PARAM_BOUNDS.halfKm.min);
  assertEquals(constant("HALF_KM_MAX"), SIGNAL_PARAM_BOUNDS.halfKm.max);
  assertEquals(constant("EXPONENT_MIN"), SIGNAL_PARAM_BOUNDS.exponent.min);
  assertEquals(constant("EXPONENT_MAX"), SIGNAL_PARAM_BOUNDS.exponent.max);
  assertEquals(constant("POPULARITY_ROOT_MIN"), SIGNAL_PARAM_BOUNDS.root.min);
  assertEquals(constant("POPULARITY_ROOT_MAX"), SIGNAL_PARAM_BOUNDS.root.max);
  assertEquals(constant("STARS_POWER_MIN"), SIGNAL_PARAM_BOUNDS.starsPower.min);
  assertEquals(constant("STARS_POWER_MAX"), SIGNAL_PARAM_BOUNDS.starsPower.max);
  assertEquals(constant("SHUFFLE_TEMPERATURE_MIN"), SIGNAL_PARAM_BOUNDS.temperature.min);
  assertEquals(constant("SHUFFLE_TEMPERATURE_MAX"), SIGNAL_PARAM_BOUNDS.temperature.max);
});

// ── The normalizer, key by key ───────────────────────────────────────────────

Deno.test("an early-migration blob reads back with every live section defaulted", () => {
  // What an early migration stored: weights + slotting only. Both retired.
  const old = {
    balance: { proximity: 2, timing: 1, category: 1, popularity: 1, summary: 1, randomness: 0.35 },
    slotting: { enabled: true, everyNth: 7 },
  };
  const cfg = normalizeDiscoveryConfig(old);
  const keys = cfg as unknown as Record<string, unknown>;
  assertEquals("weights" in keys, false);
  assertEquals("slotting" in keys, false);
  // ...and the live sections arrive at their defaults rather than undefined.
  assertEquals(cfg.params, DISCOVERY_DEFAULTS.params);
  assertEquals(cfg.map, DISCOVERY_DEFAULTS.map);
  assertEquals(cfg.name, DISCOVERY_DEFAULTS.name);
  assertEquals(cfg.chat, DISCOVERY_DEFAULTS.chat);
});

// THE SWIPE DECK RETIRED (MESITA-2328), and every key only it read went with
// it. A blob that still carries them must come back WITHOUT them, or the next
// Save writes them straight back. `swipe` is dropped, never renamed.
Deno.test("the deck's slices do not survive a normalize: swipe, engines, weights, weightsByMode", () => {
  const cfg = normalizeDiscoveryConfig({
    swipe: { radiusKm: 7, closingBufferMin: 30, minReviews: 1, savedAt: null },
    engines: { swipe: { ranked: false } },
    balance: { proximity: 1.5, mesita_level: 2, partnership: 2 },
    weightsByMode: { swipe: { timing: 1.5 }, map: { proximity: 0.5 } },
  }) as unknown as Record<string, unknown>;
  for (const dead of ["swipe", "engines", "weights", "weightsByMode"]) {
    assertEquals(dead in cfg, false, dead);
  }
});

// What the live blob still stores under `params` (2026-10-18): the deck's
// shape numbers on seven bags. Only the Area pipeline's three numbers are
// read now; the rest must not come back, or the next Save writes it back.
Deno.test("the deck's param bags and numbers are not typed params", () => {
  const cfg = normalizeSignalParams({
      name: {},
      timing: { dawn: 0.55, openShare: 0.7, closedFloor: 0.2 },
      category: { miss: 0.1, exact: 1, family: 0.55 },
      proximity: { maxKm: 25, kneeKm: 1, missingGeo: 0.35, halfDistanceKm: 6 },
      popularity: {
        confidence: 60,
        floorRating: 3,
        priorRating: 4.2,
        referenceRating: 4.5,
        referenceReviews: 500,
        halfReviews: 250,
      },
      balance: { proximity: 7 },
      randomness: {},
      summary: { unembedded: 0.4 },
      mesita_level: {},
  });
  // The retired calibration (halfDistanceKm, referenceRating/Reviews,
  // MESITA-2347) goes with the deck's bags; the linear `balance`
  // (MESITA-2428), the weights table (MESITA-2687), the reach and Selected
  // (MESITA-2703) too. Popularity's half credit (`halfReviews`, read by
  // nothing) went with MESITA-3083; the half distance, the exponent and the
  // root arrive at their defaults.
  assertEquals(cfg, { proximity: { halfKm: 1, exponent: 1 }, popularity: { root: 0.33, starsPower: 6 }, shuffle: { temperature: 0.3 }, recipes: DEFAULT_RECIPES, mix: DEFAULT_MIX });
});

// The tentative Social engine's box had no reader (MESITA-2144): its knobs
// never survive a normalize. `social` is back since MESITA-4572 with one
// setting, latestEvents (1–500, default 100).
Deno.test("social keeps only latestEvents; the retired engine's knobs drop", () => {
  const cfg = normalizeDiscoveryConfig({
    social: { seedCount: 6, generatedCount: 6, eventsPerRail: 8, minSeedEvents: 1, horizonDays: 14 },
  });
  assertEquals(cfg.social, { latestEvents: 100 });
  assertEquals(normalizeDiscoveryConfig({ social: { latestEvents: 0 } }).social.latestEvents, 1);
  assertEquals(normalizeDiscoveryConfig({ social: { latestEvents: 30.4 } }).social.latestEvents, 30);
});

Deno.test("chat.prompt round-trips, truncates, and garbage becomes blank", () => {
  assertEquals(normalizeDiscoveryConfig({ chat: { prompt: "  Be Memo.  " } }).chat.prompt, "  Be Memo.  ");
  assertEquals(normalizeDiscoveryConfig({}).chat.prompt, "");
  assertEquals(normalizeDiscoveryConfig({ chat: { prompt: 12 } }).chat.prompt, "");
  const tooLong = "x".repeat(12_001);
  assertEquals(normalizeDiscoveryConfig({ chat: { prompt: tooLong } }).chat.prompt.length, 12_000);
});

Deno.test("map knobs default on an old blob and clamp", () => {
  const missing = normalizeDiscoveryConfig({ weights: {}, slotting: {} });
  assertEquals(missing.map, DISCOVERY_DEFAULTS.map);
  const clamped = normalizeMapConfig({
    minRating: 9,
    minReviews: -2,
    minPopularity: 4,
    popularityWeight: 9,
    proximityWeight: 0.456,
  });
  assertEquals(clamped.minRating, 5);
  assertEquals(clamped.minReviews, 0);
  assertEquals(clamped.minPopularity, 1);
  // The exponents are retired (MESITA-2722): the typed map has none.
  assertEquals("popularityWeight" in clamped, false);
  assertEquals("proximityWeight" in clamped, false);
});

Deno.test("the two Mesita source switches are dropped on normalize (MESITA-2909)", () => {
  const map = normalizeMapConfig({ mesitaPopular: 0, mesitaClosest: 20 });
  assertEquals("mesitaPopular" in map || "mesitaClosest" in map, false);
});

Deno.test("the retired Google sources are dropped on normalize (MESITA-2872)", () => {
  const map = normalizeMapConfig({ googlePopular: 20, googleClosest: 20 }) as unknown as Record<string, unknown>;
  for (const dead of ["googlePopular", "googleClosest"]) {
    assertEquals(dead in map, false, dead);
  }
});

Deno.test("the retired stops and googleFill are dropped on normalize (MESITA-2703)", () => {
  const map = normalizeMapConfig({ googlePlaces: 60, mapGooglePlaces: 40, mesitaPlaces: 60, googleFill: false }) as unknown as Record<string, unknown>;
  for (const dead of ["googlePlaces", "mapGooglePlaces", "mesitaPlaces", "googleFill"]) {
    assertEquals(dead in map, false, dead);
  }
});

Deno.test("map.googlePull is retired: an old blob's key is dropped on normalize (MESITA-2298)", () => {
  // One Nearby Search (New) call per request, 20 places, never widened — the
  // Legacy 40/60 pull is gone, so the normalizer rebuilds `map` without it
  // and the next save drops it from the blob.
  const map = normalizeMapConfig({ googlePull: 60 });
  assertEquals("googlePull" in map, false);
  assertEquals("googlePull" in DISCOVERY_DEFAULTS.map, false);
});

Deno.test("map.radiusKm retired (MESITA-3086): a stored one is dropped; the no-screen radius is the constant 15 km", () => {
  const map = normalizeMapConfig({ radiusKm: 30, placesShown: 33 });
  assertEquals("radiusKm" in map, false);
  assertEquals(map.placesShown, 33);
  assertEquals(NO_SCREEN_RADIUS_KM, 15);
});

Deno.test("map.popularityRoot is the Map's own root: default 0.33, 0.1..1, two decimals (MESITA-3086)", () => {
  const root = (raw: unknown) => normalizeMapConfig({ popularityRoot: raw }).popularityRoot;
  assertEquals(DISCOVERY_DEFAULTS.map.popularityRoot, 0.33);
  assertEquals(root(undefined), 0.33);
  assertEquals(root(0.5), 0.5);
  assertEquals(root(0.3333), 0.33);
  assertEquals(root(0), 0.1);
  assertEquals(root(9), 1);
});

Deno.test("Minimum Popularity lives on name (MESITA-3086): default 2.7, 0..20, one decimal; a stored map.popularityFloor drops", () => {
  const floor = (raw: unknown) => normalizeDiscoveryConfig({ name: { popularityFloor: raw } }).name.popularityFloor;
  assertEquals(DISCOVERY_DEFAULTS.name.popularityFloor, 2.7);
  assertEquals(floor(undefined), 2.7);
  assertEquals(floor(0), 0);
  assertEquals(floor(-1), 0);
  assertEquals(floor(99), 20);
  assertEquals(floor(3.44), 3.4);
  assertEquals("popularityFloor" in normalizeMapConfig({ popularityFloor: 4 }), false);
});

Deno.test("name knobs default Fast 5 and Deep 3+3 on an old blob and clamp", () => {
  const missing = normalizeDiscoveryConfig({ weights: {}, slotting: {} });
  assertEquals(missing.name, DISCOVERY_DEFAULTS.name);
  assertEquals(missing.name.fast.count, 5);
  assertEquals(missing.name.fast.googleCount, 5);
  assertEquals(missing.name.deep, { autoCount: 3, googleCount: 3 });
  const clamped = normalizeDiscoveryConfig({
    name: {
      fast: { count: 99, supers: { restaurants: false } },
      deep: { partnerCount: 5, mesitaCount: 7.2, googleCount: 40, autoCount: 0 },
    },
  });
  assertEquals(clamped.name.fast.count, 20);
  // The retired family switches (MESITA-2767) do not survive a read.
  assertEquals("supers" in clamped.name.fast, false);
  // The retired Deep partners and Mesita caps do not survive a read.
  assertEquals("partnerCount" in clamped.name.deep, false);
  assertEquals("mesitaCount" in clamped.name.deep, false);
  assertEquals(clamped.name.deep.googleCount, 20);
  assertEquals(clamped.name.deep.autoCount, 0);
  assertEquals(clamped.name.fast.googleCount, 20);
  const missingAuto = normalizeDiscoveryConfig({
    name: { deep: { googleCount: 40 } },
  });
  assertEquals(missingAuto.name.deep.autoCount, 3);
  assertEquals(missingAuto.name.deep.googleCount, 20);
});

Deno.test("map.selectedFactor retired with Selected (MESITA-2925): a stored key is dropped, the rest kept", () => {
  const map = normalizeMapConfig({ selectedFactor: 5, placesShown: 33, reloadIdleSec: 4 });
  assertEquals("selectedFactor" in map, false);
  assertEquals(map.placesShown, 33);
  assertEquals(map.reloadIdleSec, 4);
  assertEquals("selectedFactor" in normalizeDiscoveryConfig({}).map, false);
});


// ── Premier's prices (MESITA-3043): money, so pinned both ways ──────────────

Deno.test("Premier prices: unset reads today's constants; set ones are whole clamped cents; a retired tier drops", () => {
  assertEquals(normalizeDiscoveryConfig({}).premier.yearlyCents, PREMIER_YEARLY_CENTS);
  assertEquals(normalizeDiscoveryConfig({ premier: "x" }).premier.yearlyCents, PREMIER_YEARLY_CENTS);
  const set = normalizeDiscoveryConfig({
    premier: { yearlyCents: { boost_2x: "1500.4", boost_5x: 999_999_999, boost_10x: 20000 } },
  }).premier.yearlyCents;
  assertEquals(set, { boost_2x: 1500, boost_5x: PREMIER_YEARLY_CENTS_MAX });
  const low = normalizeDiscoveryConfig({ premier: { yearlyCents: { boost_2x: 1, boost_5x: null } } }).premier.yearlyCents;
  // Never under Stripe's 50-cent floor.
  assertEquals(low.boost_2x, PREMIER_YEARLY_CENTS_MIN);
  assert(PREMIER_YEARLY_CENTS_MIN >= 50);
});

Deno.test("Premier prices: the admin twin mirrors the bounds and the defaults", () => {
  const constant = (name: string) => {
    const m = CATALOG_SRC.match(new RegExp(`export const ${name} = ([0-9_.]+);`));
    assert(m, `catalog.ts has no ${name}`);
    return Number(m[1].replaceAll("_", ""));
  };
  assertEquals(constant("PREMIER_YEARLY_CENTS_MIN"), PREMIER_YEARLY_CENTS_MIN);
  assertEquals(constant("PREMIER_YEARLY_CENTS_MAX"), PREMIER_YEARLY_CENTS_MAX);
  const m = CATALOG_SRC.match(
    /export const DEFAULT_PREMIER: PremierConfig = \{ yearlyCents: \{ boost_2x: (\d+), boost_5x: (\d+) \} \};/,
  );
  assertEquals(m ? { boost_2x: Number(m[1]), boost_5x: Number(m[2]) } : null, PREMIER_YEARLY_CENTS);
});

// ── Discovery ranking v2 (MESITA-4454): recipes, mix, unknown keys ──────────

Deno.test("recipes: the table by default; organic Premier exponent forced 0; map rows have no distance; bounds clamp and report", () => {
  assertEquals(normalizeDiscoveryConfig({}).params.recipes, DEFAULT_RECIPES);
  assertEquals(normalizeDiscoveryConfig({}).params.mix, DEFAULT_MIX);
  assertEquals(DEFAULT_RECIPES.catalogNearbyOrganic, { halfKm: 0.1, distanceExp: 4, googleExp: 0.33, foursquareFactor: 1, foursquareExponent: 20, premierExp: 0, offersExp: 0, batch: 10 });
  assertEquals(DEFAULT_RECIPES.mapInorganic, { halfKm: null, distanceExp: null, googleExp: 0.17, foursquareFactor: 1, foursquareExponent: 20, premierExp: 1, offersExp: 0, batch: null });
  assertEquals(DEFAULT_RECIPES.pay.offersExp, 1);
  const clamps: Array<[string, unknown]> = [];
  const r = normalizeRecipes({
    catalogPopularOrganic: { halfKm: 500, distanceExp: 0.1, googleExp: 0.01, premierExp: 2, offersExp: 2 },
    catalogPopularInorganic: { premierExp: 3, googleExp: "0.5" },
    catalogFamilyClose: { halfKm: null, distanceExp: "x", batch: 99, premierExp: 2 },
    mapOrganic: { halfKm: 3, distanceExp: 2, premierExp: 1 },
    pay: { offersExp: 9, premierExp: 0.24 },
  }, (key, raw) => clamps.push([key, raw]));
  // C1: an Organic row never carries a plan, and Home Offers stays 0.
  assertEquals(r.catalogPopularOrganic, { halfKm: 100, distanceExp: 0.5, googleExp: 0.1, foursquareFactor: 1, foursquareExponent: 20, premierExp: 0, offersExp: 0, batch: 10 });
  assertEquals(r.catalogPopularInorganic.premierExp, 2);
  assertEquals(r.catalogPopularInorganic.googleExp, 0.5);
  assertEquals(r.catalogPopularInorganic.offersExp, 0);
  // L-1: a null on a Catalog row reads the default and is reported.
  assertEquals([r.catalogFamilyClose.halfKm, r.catalogFamilyClose.distanceExp], [0.1, 4]);
  assertEquals(r.catalogFamilyClose.batch, 25);
  assertEquals(r.catalogFamilyClose.premierExp, 0);
  // A Map row has no Proximity: its distance numbers are always null.
  assertEquals(r.mapOrganic, { halfKm: null, distanceExp: null, googleExp: 0.33, foursquareFactor: 1, foursquareExponent: 20, premierExp: 0, offersExp: 0, batch: null });
  // The Foursquare factor is always 1, and an old 0.5 is not reported.
  assertEquals(r.catalogFamilyClose.foursquareFactor, 1);
  const kept = normalizeRecipes({ catalogNearbyOrganic: { foursquareFactor: 0.5, foursquareExponent: 20 } });
  assertEquals(kept.catalogNearbyOrganic.foursquareFactor, 1);
  assertEquals(kept.catalogNearbyOrganic.foursquareExponent, 20);
  // Pay edits Premier and Offers. 9 clamps to 2. 0.24 rounds to 0.2.
  assertEquals([r.pay.offersExp, r.pay.premierExp], [2, 0.2]);
  assertEquals(clamps.map(([k]) => k).sort(), [
    "params.recipes.catalogFamilyClose.batch",
    "params.recipes.catalogFamilyClose.distanceExp",
    "params.recipes.catalogFamilyClose.halfKm",
    "params.recipes.catalogPopularInorganic.premierExp",
    "params.recipes.catalogPopularOrganic.distanceExp",
    "params.recipes.catalogPopularOrganic.googleExp",
    "params.recipes.catalogPopularOrganic.halfKm",
    "params.recipes.pay.offersExp",
  ]);
  // An absent key is not a clamp.
  const quiet: string[] = [];
  normalizeRecipes({}, (k) => quiet.push(k));
  normalizeMix({}, (k) => quiet.push(k));
  assertEquals(quiet, []);
});

Deno.test("recipes: a save from before the twelve lanes keeps Family Inorganic on Home Family Inorganic", () => {
  const old = { halfKm: 3, distanceExp: 2, googleExp: 0.25, premierExp: 1 };
  const r = normalizeRecipes({ catalogFamilyInorganic: old });
  assertEquals([r.catalogFamilyCloseInorganic.halfKm, r.catalogFamilyCloseInorganic.googleExp], [3, 0.25]);
  assertEquals(r.catalogFamilyClose, DEFAULT_RECIPES.catalogFamilyClose);
  const saved = normalizeRecipes({ catalogFamilyInorganic: old, catalogFamilyCloseInorganic: { halfKm: 1 } });
  assertEquals(saved.catalogFamilyCloseInorganic.halfKm, 1);
});

Deno.test("mix: Temperature 0–5 per mode, ad floor 0–1, ad cadence 0–10 whole", () => {
  const seen: string[] = [];
  const m = normalizeMix(
    { temperature: { nearby: 9, family: -1, popular: 0.333 }, adFloor: 2, adEvery: 3.6 },
    (k) => seen.push(k),
  );
  assertEquals(m, {
    temperature: { nearby: 5, family: 0, popular: 0.33 },
    adEvery: 4,
    proFactor: 2,
    maxFactor: 5,
    growthWeightCap: 0.5,
  });
  assertEquals(normalizeMix({ growthWeightCap: 0.8 }).growthWeightCap, 0.8);
  assertEquals(normalizeMix({ growthWeightCap: 2 }).growthWeightCap, 0.8);
  assertEquals(seen.sort(), ["params.mix.temperature.family", "params.mix.temperature.nearby"]);
  // MESITA-5029: a saved adFloor is dropped, never read.
  assertEquals("adFloor" in m, false);
  assertEquals(normalizeMix({ adEvery: 0 }).adEvery, 0);
  assertEquals(normalizeMix({ adEvery: 99 }).adEvery, 10);
});

Deno.test("Premier Pro and Max are Mixing numbers, 1–10, defaults 2 and 5 (MESITA-5028)", () => {
  const m = normalizeMix({ proFactor: 0, maxFactor: 20 });
  assertEquals([m.proFactor, m.maxFactor], [1, 10]);
  assertEquals(premierFactors({ params: {} }), { 0: 1, 1: 2, 2: 5 });
  assertEquals(premierFactors({ params: { mix: normalizeMix({ proFactor: 1, maxFactor: 3 }) } }), { 0: 1, 1: 1, 2: 3 });
});

Deno.test("unknown keys under params and map survive a normalize and a round trip (H-2)", () => {
  const raw = {
    params: { future: { knob: 1 }, recipes: { catalogNearbyOrganic: { halfKm: 0.3 } }, shuffle: { temperature: 1.5 } },
    map: { futureMap: true, popularityRoot: 0.4 },
    future: { top: 1 },
  };
  const once = normalizeDiscoveryConfig(raw);
  const twice = normalizeDiscoveryConfig(once);
  for (const cfg of [once, twice]) {
    const params = cfg.params as unknown as Record<string, unknown>;
    const map = cfg.map as unknown as Record<string, unknown>;
    assertEquals(params.future, { knob: 1 });
    assertEquals(map.futureMap, true);
    // Retired-but-stored keys stay put (deleted only by a migration, F8).
    assertEquals(cfg.params.shuffle.temperature, 1.5);
    assertEquals(cfg.map.popularityRoot, 0.4);
    assertEquals(cfg.params.recipes.catalogNearbyOrganic.halfKm, 0.3);
    // Top-level keys are still rebuilt.
    assertEquals("future" in cfg, false);
  }
});
