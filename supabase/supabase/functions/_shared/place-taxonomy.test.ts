import { assertEquals } from "jsr:@std/assert";
import {
  ATLAS_CATEGORY_SUPERS,
  SUPER_CATEGORIES,
  familiesForAtlasCategory,
  familiesForPlace,
  readGuestFamilyKeys,
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

Deno.test("every Atlas category maps to exactly one Super Category", () => {
  const slugs = Object.keys(ATLAS_CATEGORY_SUPERS);
  assertEquals(slugs.length, 100);
  assertEquals(slugs.includes("undefined"), false);
  const covered = new Set<string>();
  for (const slug of slugs) {
    const supers = ATLAS_CATEGORY_SUPERS[slug] ?? [];
    if (supers.length !== 1) {
      throw new Error(`${slug} has ${supers.length} supers`);
    }
    covered.add(supers[0]!);
  }
  assertEquals(
    [...covered].sort(),
    SUPER_CATEGORIES.map((s) => s.slug).slice().sort(),
  );
});

Deno.test("former intersections now exclusive", () => {
  assertEquals(familiesForAtlasCategory("breakfast"), ["restaurants"]);
  assertEquals(familiesForAtlasCategory("brunch"), ["restaurants"]);
  assertEquals(familiesForAtlasCategory("karaoke"), ["bars_nightlife"]);
  assertEquals(familiesForAtlasCategory("casino"), ["experiences"]);
  assertEquals(familiesForAtlasCategory("board_game_cafe"), ["cafes_bakeries"]);
  assertEquals(familiesForAtlasCategory("winery"), ["bars_nightlife"]);
  assertEquals(familiesForAtlasCategory("movie_theater"), ["culture_arts"]);
});

Deno.test("undefined / empty category has no Super Category yet", () => {
  assertEquals(familiesForAtlasCategory("undefined"), []);
  assertEquals(familiesForAtlasCategory(null), []);
  assertEquals(familiesForAtlasCategory(""), []);
});

Deno.test("familiesForPlace uses Atlas membership, not a stored subset", () => {
  assertEquals(
    familiesForPlace({
      category: "breakfast",
      family_keys: ["cafes_bakeries"],
    }),
    ["restaurants"],
  );
  assertEquals(
    familiesForPlace({
      category: "mexican",
      family_keys: ["bars_nightlife"],
    }),
    ["restaurants"],
  );
  assertEquals(familiesForPlace({ category: "mexican" }), ["restaurants"]);
  assertEquals(familiesForPlace({ category: "gastropub" }), ["restaurants"]);
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

Deno.test("resolveEnrichedFamilyKeys keeps the one Atlas Super", () => {
  assertEquals(
    resolveEnrichedFamilyKeys("mexican", ["restaurants", "bars_nightlife"]),
    ["restaurants"],
  );
  assertEquals(
    resolveEnrichedFamilyKeys("mexican", ["bars_nightlife"]),
    ["restaurants"],
  );
  assertEquals(
    resolveEnrichedFamilyKeys("breakfast", ["cafes_bakeries"]),
    ["restaurants"],
  );
  assertEquals(
    resolveEnrichedFamilyKeys("karaoke", ["experiences"]),
    ["bars_nightlife"],
  );
  assertEquals(
    resolveEnrichedFamilyKeys("undefined", ["bars_nightlife"]),
    ["bars_nightlife"],
  );
  assertEquals(resolveEnrichedFamilyKeys("undefined", []), []);
});

Deno.test("sanitizeFamilyKeys drops junk, dedupes, caps at one, catalog order", () => {
  assertEquals(
    sanitizeFamilyKeys(["experiences", "restaurants", "restaurants", "nope"]),
    ["restaurants"],
  );
  assertEquals(sanitizeFamilyKeys(["a", "b", "c"]), []);
  assertEquals(sanitizeFamilyKeys(null), []);
});

Deno.test("readGuestFamilyKeys keeps every selected Super pill", () => {
  assertEquals(
    readGuestFamilyKeys(["experiences", "restaurants", "restaurants", "nope"]),
    ["restaurants", "experiences"],
  );
  assertEquals(readGuestFamilyKeys(["wellness_spa"]), ["wellness_spa"]);
});
