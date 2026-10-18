// The knobs MESITA-2319 wired: defaults, bounds, and the retired key that
// must not leak into the new one.
import { assertEquals } from "jsr:@std/assert@1";
import {
  CATALOG_RAIL_CAP_DEFAULT,
  normalizeCatalogConfig,
  normalizeMapConfig,
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
