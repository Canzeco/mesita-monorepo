// The knobs MESITA-2319 wired: defaults, bounds, and the retired key that
// must not leak into the new one.
import { assertEquals } from "jsr:@std/assert@1";
import {
  normalizeCatalogConfig,
  normalizeMapConfig,
  normalizeDeepConfig,
  normalizeDiscoveryConfig,
  normalizeNameConfig,
} from "./discovery-config.ts";

Deno.test("catalog placesPerRail normalizes within bounds", () => {
  assertEquals(normalizeCatalogConfig({ placesPerRail: 8 }).placesPerRail, 8);
  assertEquals(normalizeCatalogConfig({}).placesPerRail, 8);
});

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

Deno.test("Word by Admin defaults are Find's old behaviour; Mesita rows stop at 10", () => {
  assertEquals(normalizeNameConfig({}).admin, {
    autoCount: 0,
    textCount: 20,
    mesitaCount: 10,
    emptyQuery: true,
  });
  const a = normalizeNameConfig({
    admin: { autoCount: 5, textCount: 99, mesitaCount: 40, emptyQuery: false },
  }).admin;
  assertEquals(a, { autoCount: 5, textCount: 20, mesitaCount: 10, emptyQuery: false });
});

Deno.test("the admin EF asks for Word by Admin's caps; the lane returns idleSec", async () => {
  const adminEf = await Deno.readTextFile(
    new URL("../admin-web-suggest-places/index.ts", import.meta.url),
  );
  const consumerEf = await Deno.readTextFile(
    new URL("../consumer-web-suggest-places/index.ts", import.meta.url),
  );
  const lane = await Deno.readTextFile(new URL("./consumer-search-lane.ts", import.meta.url));
  assertEquals(adminEf.includes("admin: true"), true);
  assertEquals(consumerEf.includes("admin: true"), false);
  assertEquals(lane.includes("idleSec: cfg.name.idleSec"), true);
  assertEquals(lane.includes("cfg.name.admin.mesitaCount"), true);
});

Deno.test("an old blob with no Area params reads the defaults (MESITA-2327, MESITA-2347)", () => {
  const cfg = normalizeDiscoveryConfig({
    params: { proximity: { maxKm: 25, kneeKm: 1, missingGeo: 0.35 }, popularity: { confidence: 60 } },
    catalog: { ranking: { proximity: 1, popularity: 1 } },
  });
  assertEquals(cfg.params, { proximity: { radiusDivisor: 2, catalogRadiusDivisor: 2 }, popularity: { halfReviews: 100 } });
  assertEquals("ranking" in cfg.catalog, false);
});

Deno.test("Area params clamp; the reach, the fixed half distance, Selected and the weights table drop, the divisor arrives (MESITA-2687, MESITA-2703, MESITA-2720)", () => {
  const cfg = normalizeDiscoveryConfig({
    params: {
      proximity: { reachKm: 7, halfKm: 4, radiusDivisor: 0.01 },
      selected: { otherFactor: 0.3 },
      popularity: { halfReviews: 0 },
      modes: { nearby: { proximity: 99, popularity: -4 }, popular: { popularity: 1.234 } },
      balance: { proximity: 7 },
    },
  });
  assertEquals(cfg.params, { proximity: { radiusDivisor: 0.1, catalogRadiusDivisor: 0.1 }, popularity: { halfReviews: 1 } });
  // One decimal, clamped to 10; a stored row with only the old fixed
  // half distance reads the default 2 (never its 10 as a divisor).
  assertEquals(normalizeDiscoveryConfig({ params: { proximity: { radiusDivisor: 2.34 } } }).params.proximity, { radiusDivisor: 2.3, catalogRadiusDivisor: 2.3 });
  assertEquals(normalizeDiscoveryConfig({ params: { proximity: { radiusDivisor: 999 } } }).params.proximity, { radiusDivisor: 10, catalogRadiusDivisor: 10 });
  assertEquals(normalizeDiscoveryConfig({ params: { proximity: { halfKm: 10 } } }).params.proximity, { radiusDivisor: 2, catalogRadiusDivisor: 2 });
  // The Catalog penalty clamps on its own and, missing, reads the Map's (MESITA-2727).
  assertEquals(
    normalizeDiscoveryConfig({ params: { proximity: { radiusDivisor: 3, catalogRadiusDivisor: 0.04 } } }).params.proximity,
    { radiusDivisor: 3, catalogRadiusDivisor: 0.1 },
  );
  const m = normalizeDiscoveryConfig({ map: { placesShown: 33 } }).map;
  assertEquals([m.placesShown, m.catalogPlacesShown], [33, 33]);
  const n = normalizeDiscoveryConfig({ map: { placesShown: 33, catalogPlacesShown: 500 } }).map;
  assertEquals([n.placesShown, n.catalogPlacesShown], [33, 80]);
});

Deno.test("Deep: limit 5 and no floor by default; both clamp", () => {
  assertEquals(normalizeDeepConfig(undefined), { limit: 5, minSimilarity: 0 });
  assertEquals(normalizeDeepConfig({ limit: 99, minSimilarity: 1.7 }), { limit: 20, minSimilarity: 1 });
  assertEquals(normalizeDiscoveryConfig({}).deep, { limit: 5, minSimilarity: 0 });
});
