// The knobs MESITA-2319 wired: defaults, bounds, and the retired key that
// must not leak into the new one.
import { assertEquals } from "jsr:@std/assert@1";
import {
  normalizeMapConfig,
  normalizeDeepConfig,
  normalizeDiscoveryConfig,
  normalizeNameConfig,
} from "./discovery-config.ts";

Deno.test("the Map's reload throttle defaults to 1.5 s, bounded like the client's 0.5..10 (MESITA-2444)", () => {
  assertEquals(normalizeMapConfig({}).reloadIdleSec, 1.5);
  assertEquals(normalizeMapConfig({ reloadIdleSec: 0.1 }).reloadIdleSec, 0.5);
  assertEquals(normalizeMapConfig({ reloadIdleSec: 99 }).reloadIdleSec, 10);
  assertEquals(normalizeMapConfig({ reloadIdleSec: 2.25 }).reloadIdleSec, 2.25);
  // The dead pair is dropped on read (MESITA-2687).
  assertEquals("reloadMinKm" in normalizeMapConfig({ reloadMinKm: 1, reloadMinSec: 4 }), false);
});

Deno.test("the Map's min screen move defaults to 15%, bounded 0..50 (MESITA-2732)", () => {
  assertEquals(normalizeMapConfig({}).reloadMinViewportPct, 15);
  assertEquals(normalizeMapConfig({ reloadMinViewportPct: -4 }).reloadMinViewportPct, 0);
  assertEquals(normalizeMapConfig({ reloadMinViewportPct: 99 }).reloadMinViewportPct, 50);
  assertEquals(normalizeMapConfig({ reloadMinViewportPct: 12.26 }).reloadMinViewportPct, 12.3);
});

Deno.test("Word's Locations default on; an operator false sticks", () => {
  assertEquals(normalizeNameConfig({}).locations, true);
  assertEquals(normalizeNameConfig({ locations: false }).locations, false);
});

Deno.test("Word's idle seconds default to 1, bounded 0.3..5, one decimal (MESITA-2322)", () => {
  assertEquals(normalizeNameConfig({}).idleSec, 1);
  assertEquals(normalizeNameConfig({ idleSec: 0.05 }).idleSec, 0.3);
  assertEquals(normalizeNameConfig({ idleSec: 9 }).idleSec, 5);
  assertEquals(normalizeNameConfig({ idleSec: 1.26 }).idleSec, 1.3);
});

Deno.test("Word by Admin defaults are Find's old behaviour; a stored mesitaCount is dropped", () => {
  assertEquals(normalizeNameConfig({}).admin, {
    autoCount: 0,
    textCount: 20,
    emptyQuery: true,
  });
  const a = normalizeNameConfig({
    admin: { autoCount: 5, textCount: 99, mesitaCount: 40, emptyQuery: false },
  }).admin;
  assertEquals(a, { autoCount: 5, textCount: 20, emptyQuery: false });
});

Deno.test("the admin EF asks for Word by Admin's caps; the lane returns idleSec", async () => {
  const adminEf = await Deno.readTextFile(
    new URL("../admin-web-suggest-places/index.ts", import.meta.url),
  );
  const consumerEf = await Deno.readTextFile(
    new URL("../consumer-web-suggest-places/index.ts", import.meta.url),
  );
  const lane = await Deno.readTextFile(new URL("./name-pipeline.ts", import.meta.url));
  assertEquals(adminEf.includes("runAdminNamePipeline("), true);
  assertEquals(adminEf.includes("runConsumerNamePipeline"), false);
  assertEquals(consumerEf.includes("runConsumerNamePipeline("), true);
  assertEquals(consumerEf.includes("runAdminNamePipeline"), false);
  assertEquals(lane.includes("idleSec: cfg.name.idleSec"), true);
  assertEquals(lane.includes("cfg.name.admin.autoCount"), true);
});

Deno.test("an old blob with no Area params reads the defaults (MESITA-2327, MESITA-2347)", () => {
  const cfg = normalizeDiscoveryConfig({
    params: { proximity: { maxKm: 25, kneeKm: 1, missingGeo: 0.35 }, popularity: { confidence: 60 } },
    catalog: { ranking: { proximity: 1, popularity: 1 } },
  });
  assertEquals(cfg.params, { proximity: { halfKm: 1, exponent: 1 }, popularity: { root: 0.33 } });
  assertEquals("catalog" in cfg, false);
});

Deno.test("params clamp; the reach, the divisor, Selected and the weights table drop, the half distance arrives (MESITA-2687, MESITA-2703, MESITA-2909)", () => {
  const cfg = normalizeDiscoveryConfig({
    params: {
      proximity: { reachKm: 7, halfKm: 0.01, radiusDivisor: 3 },
      selected: { otherFactor: 0.3 },
      popularity: { halfReviews: 0, root: 0 },
      modes: { nearby: { proximity: 99, popularity: -4 }, popular: { popularity: 1.234 } },
      balance: { proximity: 7 },
    },
  });
  assertEquals(cfg.params, { proximity: { halfKm: 0.1, exponent: 1 }, popularity: { root: 0.1 } });
  // The exponent and the root clamp at their own decimals (MESITA-3083); a
  // stored `halfReviews` drops.
  assertEquals(
    normalizeDiscoveryConfig({ params: { proximity: { exponent: 9 }, popularity: { root: 0.3333 } } }).params,
    { proximity: { halfKm: 1, exponent: 4 }, popularity: { root: 0.33 } },
  );
  assertEquals(normalizeDiscoveryConfig({ params: { proximity: { exponent: 0.04 } } }).params.proximity.exponent, 0.5);
  // One decimal, clamped to 100; a stored row with only the retired divisor
  // reads the default 1 km (MESITA-3015).
  assertEquals(normalizeDiscoveryConfig({ params: { proximity: { halfKm: 2.34 } } }).params.proximity, { halfKm: 2.3, exponent: 1 });
  assertEquals(normalizeDiscoveryConfig({ params: { proximity: { halfKm: 999 } } }).params.proximity, { halfKm: 100, exponent: 1 });
  assertEquals(normalizeDiscoveryConfig({ params: { proximity: { radiusDivisor: 1 } } }).params.proximity, { halfKm: 1, exponent: 1 });
  // Most pins 1..200 default 50; the Catalog page size 5..100 default 20,
  // and the retired cut `catalogPlacesShown` drops (MESITA-2909).
  const m = normalizeDiscoveryConfig({ map: { placesShown: 33, catalogPlacesShown: 40 } }).map;
  assertEquals([m.placesShown, m.catalogPageSize, "catalogPlacesShown" in m], [33, 20, false]);
  const n = normalizeDiscoveryConfig({ map: { placesShown: 900, catalogPageSize: 500 } }).map;
  assertEquals([n.placesShown, n.catalogPageSize], [200, 100]);
  assertEquals(normalizeDiscoveryConfig({}).map.placesShown, 50);
});

Deno.test("Deep: limit 5 and no floor by default; both clamp", () => {
  assertEquals(normalizeDeepConfig(undefined), { limit: 5, minSimilarity: 0 });
  assertEquals(normalizeDeepConfig({ limit: 99, minSimilarity: 1.7 }), { limit: 20, minSimilarity: 1 });
  assertEquals(normalizeDiscoveryConfig({}).deep, { limit: 5, minSimilarity: 0 });
});
