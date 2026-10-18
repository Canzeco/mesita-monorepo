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
