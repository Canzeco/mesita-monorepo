import { assertEquals } from "jsr:@std/assert";
import {
  ATLAS_CATEGORY_SUPERS,
  SUPER_CATEGORIES,
  familiesForAtlasCategory,
  familiesForPlace,
  resolveEnrichedFamilyKeys,
  sanitizeFamilyKeys,
} from "./place-taxonomy.ts";

Deno.test("Atlas Super Category catalog is six slugs in the 5–10 band", () => {
  assertEquals(SUPER_CATEGORIES.length, 6);
  assertEquals(SUPER_CATEGORIES.map((s) => s.slug), [
    "restaurants",
    "bars_nightlife",
    "cafes_bakeries",
    "wellness_spa",
    "experiences",
    "culture_arts",
  ]);
});

Deno.test("every Atlas category maps to 1 or 2 Super Categories", () => {
  const slugs = Object.keys(ATLAS_CATEGORY_SUPERS);
  assertEquals(slugs.length, 100);
  assertEquals(slugs.includes("undefined"), false);
  for (const slug of slugs) {
    const supers = ATLAS_CATEGORY_SUPERS[slug] ?? [];
    if (supers.length < 1 || supers.length > 2) {
      throw new Error(`${slug} has ${supers.length} supers`);
    }
  }
});

Deno.test("intersections: a category may sit in two Super Categories", () => {
  assertEquals(familiesForAtlasCategory("breakfast"), [
    "restaurants",
    "cafes_bakeries",
  ]);
  assertEquals(familiesForAtlasCategory("brunch"), [
    "restaurants",
    "cafes_bakeries",
  ]);
  assertEquals(familiesForAtlasCategory("karaoke"), [
    "bars_nightlife",
    "experiences",
  ]);
  assertEquals(familiesForAtlasCategory("casino"), [
    "bars_nightlife",
    "experiences",
  ]);
  assertEquals(familiesForAtlasCategory("board_game_cafe"), [
    "cafes_bakeries",
    "experiences",
  ]);
  assertEquals(familiesForAtlasCategory("winery"), [
    "bars_nightlife",
    "experiences",
  ]);
  assertEquals(familiesForAtlasCategory("movie_theater"), [
    "experiences",
    "culture_arts",
  ]);
});

Deno.test("undefined / empty category has no Super Category yet", () => {
  assertEquals(familiesForAtlasCategory("undefined"), []);
  assertEquals(familiesForAtlasCategory(null), []);
  assertEquals(familiesForAtlasCategory(""), []);
});

Deno.test("familiesForPlace uses full Atlas membership, not a stored subset", () => {
  assertEquals(
    familiesForPlace({
      category: "breakfast",
      family_keys: ["restaurants"],
    }),
    ["restaurants", "cafes_bakeries"],
  );
  assertEquals(
    familiesForPlace({
      category: "mexican",
      family_keys: ["bars_nightlife"],
    }),
    ["restaurants"],
  );
  assertEquals(familiesForPlace({ category: "mexican" }), ["restaurants"]);
  assertEquals(familiesForPlace({ category: "gastropub" }), [
    "restaurants",
    "bars_nightlife",
  ]);
  assertEquals(
    familiesForPlace({
      category: "undefined",
      family_keys: ["bars_nightlife"],
    }),
    ["bars_nightlife"],
  );
  assertEquals(familiesForPlace({ category: "undefined" }), []);
  assertEquals(familiesForPlace({ category: "gas_station" }), []);
});

Deno.test("resolveEnrichedFamilyKeys never shrinks a multi-super category", () => {
  assertEquals(
    resolveEnrichedFamilyKeys("mexican", ["restaurants", "bars_nightlife"]),
    ["restaurants"],
  );
  assertEquals(
    resolveEnrichedFamilyKeys("mexican", ["bars_nightlife"]),
    ["restaurants"],
  );
  assertEquals(
    resolveEnrichedFamilyKeys("breakfast", ["restaurants"]),
    ["restaurants", "cafes_bakeries"],
  );
  assertEquals(
    resolveEnrichedFamilyKeys("breakfast", ["restaurants", "cafes_bakeries"]),
    ["restaurants", "cafes_bakeries"],
  );
  assertEquals(
    resolveEnrichedFamilyKeys("karaoke", ["experiences"]),
    ["bars_nightlife", "experiences"],
  );
  assertEquals(
    resolveEnrichedFamilyKeys("undefined", ["bars_nightlife"]),
    ["bars_nightlife"],
  );
  assertEquals(resolveEnrichedFamilyKeys("undefined", []), []);
});

Deno.test("sanitizeFamilyKeys drops junk, dedupes, caps at two, catalog order", () => {
  assertEquals(
    sanitizeFamilyKeys(["experiences", "restaurants", "restaurants", "nope"]),
    ["restaurants", "experiences"],
  );
  assertEquals(sanitizeFamilyKeys(["a", "b", "c"]), []);
  assertEquals(sanitizeFamilyKeys(null), []);
});
