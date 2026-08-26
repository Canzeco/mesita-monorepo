import { assertEquals } from "jsr:@std/assert@1";
import {
  matchIlike,
  occupiedFromRows,
  pickN,
  planCatalogRails,
  sliceSeedPlaces,
} from "./catalog-engine.ts";
import { CATALOG_VIBE_QUERIES } from "./catalog-vibe-queries.ts";
import { DEFAULT_CATALOG, normalizeCatalogConfig } from "./discovery-config.ts";

Deno.test("pickN never exceeds the bag", () => {
  assertEquals(pickN([1, 2, 3], 10, () => 0).length, 3);
  assertEquals(pickN([1, 2, 3], 0).length, 0);
});

Deno.test("occupiedFromRows drops thin and undefined categories", () => {
  const occ = occupiedFromRows(
    [
      { category: "tacos", category_label: "Tacos" },
      { category: "tacos", category_label: "Tacos" },
      { category: "wine", category_label: "Wine" },
      { category: "undefined", category_label: "❓" },
      { category: null, category_label: null },
    ],
    2,
  );
  assertEquals(occ.map((c) => c.slug), ["tacos"]);
  assertEquals(occ[0]?.count, 2);
});

Deno.test("planCatalogRails mixes seed then generated and skips label collisions", () => {
  const occupied = [
    { slug: "tacos", label: "Tacos", count: 12 },
    { slug: "wine_bar", label: "Natural wine", count: 5 },
  ];
  const rng = () => 0;
  const rails = planCatalogRails(
    { ...DEFAULT_CATALOG, seedCount: 2, generatedCount: 3 },
    occupied,
    CATALOG_VIBE_QUERIES,
    rng,
  );
  assertEquals(rails.filter((r) => r.source === "seed").length, 2);
  assertEquals(rails.some((r) => r.label === "Natural wine" && r.source === "generated"), false);
  assertEquals(rails.filter((r) => r.source === "generated").length, 3);
});

Deno.test("normalizeCatalogConfig clamps and defaults", () => {
  assertEquals(normalizeCatalogConfig(null), DEFAULT_CATALOG);
  assertEquals(normalizeCatalogConfig({ seedCount: 99, placesPerRail: 1 }).seedCount, 20);
  assertEquals(normalizeCatalogConfig({ placesPerRail: 1 }).placesPerRail, 4);
});

Deno.test("sliceSeedPlaces samples one Atlas slug", () => {
  const rows = [
    { category: "tacos", name: "A" },
    { category: "wine", name: "B" },
    { category: "tacos", name: "C" },
  ];
  assertEquals(sliceSeedPlaces(rows, "tacos", 8).map((r) => r.name).sort(), ["A", "C"]);
});

Deno.test("planCatalogRails is empty when both counts are zero", () => {
  assertEquals(
    planCatalogRails(
      { ...DEFAULT_CATALOG, seedCount: 0, generatedCount: 0 },
      [{ slug: "tacos", label: "Tacos", count: 9 }],
      CATALOG_VIBE_QUERIES,
    ),
    [],
  );
});

Deno.test("matchIlike keeps token hits and drops zeroes", () => {
  const rows = [
    { name: "Taco Naco", vibe: "late night" },
    { name: "Quiet Room", vibe: "fine dining" },
  ];
  const hit = matchIlike(rows, "late night tacos", 8);
  assertEquals(hit.map((r) => r.name), ["Taco Naco"]);
});
