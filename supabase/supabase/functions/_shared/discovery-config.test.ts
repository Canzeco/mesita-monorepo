// MESITA-2328 — the Swipe deck and the seven-signal library retired, and the
// blob keys only they read went with them: `weights`, `weightsByMode`,
// `engines`, the `swipe` slice and the deck's numbers on `params`.
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

/** `app_config.discovery_config` as stored on 2026-10-18, before this change. */
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

const LIVE_KEYS = ["catalog", "chat", "deep", "filters", "general", "map", "name", "params"];
const RETIRED_KEYS = ["weights", "weightsByMode", "engines", "swipe"];

Deno.test("the live blob loads: the deck's keys drop, every live value stands", () => {
  const cfg = normalizeDiscoveryConfig(LIVE_BLOB_2026_10_18);
  assertEquals(Object.keys(cfg).sort(), LIVE_KEYS);
  // `filters` survives: consumer-web-list-places still reads it.
  assertEquals(cfg.filters, LIVE_BLOB_2026_10_18.filters);
  assertEquals(cfg.general, LIVE_BLOB_2026_10_18.general);
  assertEquals(cfg.map.pinCount, 60);
  assertEquals(cfg.map.reloadMinKm, 0.25);
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
  assertEquals(afterSave.filters, first.filters);
});

Deno.test("garbage never throws: loadDiscoveryConfig would swallow it into defaults", () => {
  for (const raw of [null, undefined, "x", 3, [], { params: "x", filters: [], map: null }]) {
    const cfg = normalizeDiscoveryConfig(raw);
    assertEquals(Object.keys(cfg).sort(), LIVE_KEYS);
  }
});

// ── The deck itself ──────────────────────────────────────────────────────────

Deno.test("the deck's EF and library are gone, and the cloud copy is on the leftover list", async () => {
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
  // `functions deploy` only adds: this line is what deletes it from the cloud.
  const deploy = await Deno.readTextFile(
    new URL("../../../../.github/workflows/supabase-deploy.yml", import.meta.url),
  );
  assert(/^\s+consumer-web-recommend-swipe$/m.test(deploy), "not on the leftover list");
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

Deno.test("the admin twin rebuilds none of the deck's keys", () => {
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
      "WEIGHTED_MODE_KEYS",
      "WIRED_ENGINE_KEYS",
      "SIGNAL_KEYS",
    ]
  ) {
    assertEquals(new RegExp(`\\b${dead}\\b`).test(code), false, `catalog.ts still names ${dead}`);
  }
});

Deno.test("the admin twin mirrors the Area params' bounds", () => {
  const constant = (name: string) => {
    const m = CATALOG_SRC.match(new RegExp(`export const ${name} = ([0-9_.]+);`));
    assert(m, `catalog.ts has no ${name}`);
    return Number(m[1].replaceAll("_", ""));
  };
  assertEquals(constant("HALF_DISTANCE_KM_MIN"), SIGNAL_PARAM_BOUNDS.halfDistanceKm.min);
  assertEquals(constant("HALF_DISTANCE_KM_MAX"), SIGNAL_PARAM_BOUNDS.halfDistanceKm.max);
  assertEquals(constant("REFERENCE_RATING_MIN"), SIGNAL_PARAM_BOUNDS.referenceRating.min);
  assertEquals(constant("REFERENCE_RATING_MAX"), SIGNAL_PARAM_BOUNDS.referenceRating.max);
  assertEquals(constant("REFERENCE_REVIEWS_MIN"), SIGNAL_PARAM_BOUNDS.referenceReviews.min);
  assertEquals(constant("REFERENCE_REVIEWS_MAX"), SIGNAL_PARAM_BOUNDS.referenceReviews.max);
});
