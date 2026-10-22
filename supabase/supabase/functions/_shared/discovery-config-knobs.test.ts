// The knobs MESITA-2319 wired: defaults, bounds, and the retired key that
// must not leak into the new one.
import { assertEquals } from "jsr:@std/assert@1";
import {
  CATALOG_RAIL_CAP_DEFAULT,
  normalizeCatalogConfig,
  normalizeMapConfig,
  normalizeDeepConfig,
  normalizeDiscoveryConfig,
  normalizeNameConfig,
} from "./discovery-config.ts";

Deno.test("railCap defaults to 5 and ignores the stored placesPerRail 8", () => {
  assertEquals(normalizeCatalogConfig({ placesPerRail: 8 }).railCap, CATALOG_RAIL_CAP_DEFAULT);
  assertEquals(CATALOG_RAIL_CAP_DEFAULT, 5);
  assertEquals(normalizeCatalogConfig({ railCap: 7 }).railCap, 7);
  assertEquals(normalizeCatalogConfig({ railCap: 99 }).railCap, 10);
  assertEquals(normalizeCatalogConfig({ railCap: 0 }).railCap, 1);
});

Deno.test("googleMinReviews defaults to off and is a whole number of people", () => {
  assertEquals(normalizeMapConfig({}).googleMinReviews, 0);
  assertEquals(normalizeMapConfig({ googleMinReviews: 250.6 }).googleMinReviews, 251);
  assertEquals(normalizeMapConfig({ googleMinReviews: -3 }).googleMinReviews, 0);
});

Deno.test("the Map's reload throttle defaults to 1.5 s, bounded like the client's 0.5..10 (MESITA-2444)", () => {
  assertEquals(normalizeMapConfig({}).reloadIdleSec, 1.5);
  assertEquals(normalizeMapConfig({ reloadIdleSec: 0.1 }).reloadIdleSec, 0.5);
  assertEquals(normalizeMapConfig({ reloadIdleSec: 99 }).reloadIdleSec, 10);
  assertEquals(normalizeMapConfig({ reloadIdleSec: 2.25 }).reloadIdleSec, 2.25);
  // The dead pair is dropped on read (MESITA-2687).
  assertEquals("reloadMinKm" in normalizeMapConfig({ reloadMinKm: 1, reloadMinSec: 4 }), false);
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
  assertEquals(cfg.params.popularity.halfReviews, 100);
  assertEquals(cfg.params.selected, { otherFactor: 0.3 });
  // The retired deck's numbers and the Catalog ranking are dropped (MESITA-2328);
  // Proximity's bag holds only its reach (MESITA-2431), at the default.
  assertEquals(cfg.params.proximity, { reachKm: 15 });
  assertEquals("confidence" in cfg.params.popularity, false);
  assertEquals("ranking" in cfg.catalog, false);
});

Deno.test("Area params clamp to their bounds; the weights table drops (MESITA-2687)", () => {
  const cfg = normalizeDiscoveryConfig({
    params: {
      proximity: { reachKm: 0.2 },
      popularity: { halfReviews: 0 },
      modes: { nearby: { proximity: 99, popularity: -4 }, popular: { popularity: 1.234 } },
      balance: { proximity: 7 },
    },
  });
  assertEquals(cfg.params.proximity.reachKm, 1);
  assertEquals(normalizeDiscoveryConfig({ params: { proximity: { reachKm: 99 } } }).params.proximity.reachKm, 50);
  assertEquals(normalizeDiscoveryConfig({ params: { proximity: { reachKm: 12.34 } } }).params.proximity.reachKm, 12.3);
  assertEquals(cfg.params.popularity.halfReviews, 1);
  assertEquals("modes" in cfg.params, false);
  assertEquals("balance" in cfg.params, false);
});

Deno.test("Selected's number for every other place (MESITA-2439): default 0.3, never 0", () => {
  assertEquals(normalizeDiscoveryConfig({}).params.selected.otherFactor, 0.3);
  const cfg = normalizeDiscoveryConfig({ params: { selected: { otherFactor: 0 } } });
  // Never 0: Selected stays a signal, never a gate.
  assertEquals(cfg.params.selected.otherFactor, 0.01);
  assertEquals(
    normalizeDiscoveryConfig({ params: { selected: { otherFactor: 0.456 } } }).params.selected.otherFactor,
    0.46,
  );
  assertEquals(
    normalizeDiscoveryConfig({ params: { selected: { otherFactor: 3 } } }).params.selected.otherFactor,
    1,
  );
});

Deno.test("Deep: limit 5 and no floor by default; both clamp", () => {
  assertEquals(normalizeDeepConfig(undefined), { limit: 5, minSimilarity: 0 });
  assertEquals(normalizeDeepConfig({ limit: 99, minSimilarity: 1.7 }), { limit: 20, minSimilarity: 1 });
  assertEquals(normalizeDiscoveryConfig({}).deep, { limit: 5, minSimilarity: 0 });
});
