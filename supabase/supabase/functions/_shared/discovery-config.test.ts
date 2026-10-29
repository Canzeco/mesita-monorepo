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
  DISCOVERY_DEFAULTS,
  normalizeDiscoveryConfig,
  SIGNAL_PARAM_BOUNDS,
} from "./discovery-config.ts";

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
const LIVE_KEYS = ["chat", "deep", "general", "map", "name", "params"];
const RETIRED_KEYS = ["weights", "weightsByMode", "engines", "swipe", "filters", "catalog"];

Deno.test("the live blob loads: the retired keys drop, every live value stands", () => {
  const cfg = normalizeDiscoveryConfig(LIVE_BLOB_2026_10_18);
  assertEquals(Object.keys(cfg).sort(), LIVE_KEYS);
  for (const dead of RETIRED_KEYS) {
    assertEquals(dead in cfg, false, dead);
  }
  // `general.minReviews` is retired (MESITA-2702): the one floor is map's.
  assertEquals(cfg.general, { requireActive: true });
  // `pinCount`, `supers`, the reload km/sec pair and `googleFill` are
  // dropped and seed nothing (MESITA-2687, MESITA-2703); the four source
  // switches are gone (MESITA-2872, MESITA-2909).
  assertEquals("mesitaPopular" in cfg.map || "mesitaClosest" in cfg.map, false);
  for (
    const dead of ["pinCount", "supers", "reloadMinKm", "reloadMinSec", "googleFill", "googlePull", "googlePopular", "googleClosest"]
  ) {
    assertEquals(dead in cfg.map, false, dead);
  }
  assertEquals(cfg.chat.prompt, "Be Memo.");
  // The deck's numbers on `params` go; the Area pipeline's three arrive at
  // their provisional defaults because the live blob never stored them.
  assertEquals(cfg.params, DISCOVERY_DEFAULTS.params);
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
Deno.test("the deck's param bags and numbers do not survive a normalize", () => {
  const cfg = normalizeDiscoveryConfig({
    params: {
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
    },
  });
  // The retired calibration (halfDistanceKm, referenceRating/Reviews,
  // MESITA-2347) goes with the deck's bags; the linear `balance`
  // (MESITA-2428), the weights table (MESITA-2687), the reach and Selected
  // (MESITA-2703) too. Popularity's half credit (`halfReviews`, read by
  // nothing) went with MESITA-3083; the half distance, the exponent and the
  // root arrive at their defaults.
  assertEquals(cfg.params, { proximity: { halfKm: 1, exponent: 1 }, popularity: { root: 0.33 } });
});

// The tentative Social engine's box had no reader (MESITA-2144). A blob that
// still carries it must come back without it, like `slotting` before it.
Deno.test("the retired social box does not survive a normalize", () => {
  const cfg = normalizeDiscoveryConfig({
    social: { seedCount: 6, generatedCount: 6, eventsPerRail: 8, minSeedEvents: 1, horizonDays: 14 },
  });
  assertEquals("social" in cfg, false);
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
  const clamped = normalizeDiscoveryConfig({
    map: {
      minRating: 9,
      minReviews: -2,
      minPopularity: 4,
      popularityWeight: 9,
      proximityWeight: 0.456,
    },
  });
  assertEquals(clamped.map.minRating, 5);
  assertEquals(clamped.map.minReviews, 0);
  assertEquals(clamped.map.minPopularity, 1);
  // The exponents are retired (MESITA-2722): a stored one is dropped.
  assertEquals("popularityWeight" in clamped.map, false);
  assertEquals("proximityWeight" in clamped.map, false);
});

Deno.test("the two Mesita source switches are dropped on normalize (MESITA-2909)", () => {
  const map = normalizeDiscoveryConfig({ map: { mesitaPopular: 0, mesitaClosest: 20 } }).map;
  assertEquals("mesitaPopular" in map || "mesitaClosest" in map, false);
});

Deno.test("the retired Google sources are dropped on normalize (MESITA-2872)", () => {
  const map = normalizeDiscoveryConfig({
    map: { googlePopular: 20, googleClosest: 20 },
  }).map as unknown as Record<string, unknown>;
  for (const dead of ["googlePopular", "googleClosest"]) {
    assertEquals(dead in map, false, dead);
  }
});

Deno.test("the retired stops and googleFill are dropped on normalize (MESITA-2703)", () => {
  const map = normalizeDiscoveryConfig({
    map: { googlePlaces: 60, mapGooglePlaces: 40, mesitaPlaces: 60, googleFill: false },
  }).map as unknown as Record<string, unknown>;
  for (const dead of ["googlePlaces", "mapGooglePlaces", "mesitaPlaces", "googleFill"]) {
    assertEquals(dead in map, false, dead);
  }
});

Deno.test("map.googlePull is retired: an old blob's key is dropped on normalize (MESITA-2298)", () => {
  // One Nearby Search (New) call per request, 20 places, never widened — the
  // Legacy 40/60 pull is gone, so the normalizer rebuilds `map` without it
  // and the next save drops it from the blob.
  const map = normalizeDiscoveryConfig({ map: { googlePull: 60 } }).map;
  assertEquals("googlePull" in map, false);
  assertEquals("googlePull" in DISCOVERY_DEFAULTS.map, false);
});

Deno.test("map.radiusKm is the one Nearby radius: default 15 (the reach, MESITA-2687), clamped 1..50, one decimal", () => {
  // Shared by the Map and the Feed's Google Places and Mesita Selected rails
  // (MESITA-2298). The operator's number; a guest never sends it. 50 km is
  // Google's Nearby circle cap, so the knob cannot ask for more.
  const radius = (raw: unknown) =>
    normalizeDiscoveryConfig({ map: { radiusKm: raw } }).map.radiusKm;
  assertEquals(normalizeDiscoveryConfig({}).map.radiusKm, 15);
  assertEquals(DISCOVERY_DEFAULTS.map.radiusKm, 15);
  assertEquals(radius(0.2), 1);
  assertEquals(radius(999), 50);
  assertEquals(radius(12.34), 12.3);
  assertEquals(radius(7), 7);
  assertEquals(radius("far"), 15);
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
  const map = normalizeDiscoveryConfig({ map: { selectedFactor: 5, placesShown: 33, popularityFloor: 4 } }).map;
  assertEquals("selectedFactor" in map, false);
  assertEquals(map.placesShown, 33);
  assertEquals(map.popularityFloor, 4);
  assertEquals("selectedFactor" in normalizeDiscoveryConfig({}).map, false);
});

