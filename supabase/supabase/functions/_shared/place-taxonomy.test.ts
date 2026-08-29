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

Deno.test("Atlas Super Category catalog is eight slugs: seven real + Other last", () => {
  assertEquals(SUPER_CATEGORIES.length, 8);
  assertEquals(SUPER_CATEGORIES.map((s) => s.slug), [
    "restaurants",
    "cafes_bakeries",
    "bars_nightlife",
    "experiences",
    "culture_arts",
    "sports_fitness",
    "wellness_beauty",
    "undefined",
  ]);
  const last = SUPER_CATEGORIES[SUPER_CATEGORIES.length - 1]!;
  assertEquals(last.slug, "undefined");
  assertEquals(last.label, "Other");
  assertEquals(last.sort_order, 999);
});

Deno.test("every Atlas category maps to 1–2 supers; exactly seven doubles", () => {
  const slugs = Object.keys(ATLAS_CATEGORY_SUPERS);
  assertEquals(slugs.length, 101);
  assertEquals(slugs.includes("undefined"), true);
  const covered = new Set<string>();
  const doubles: string[] = [];
  for (const slug of slugs) {
    const supers = ATLAS_CATEGORY_SUPERS[slug] ?? [];
    if (supers.length < 1 || supers.length > 2) {
      throw new Error(`${slug} has ${supers.length} supers`);
    }
    if (supers.length === 2) doubles.push(slug);
    for (const s of supers) covered.add(s);
  }
  assertEquals(doubles.sort(), [
    "board_game_cafe",
    "breakfast",
    "brunch",
    "casino",
    "karaoke",
    "movie_theater",
    "winery",
  ]);
  assertEquals(
    [...covered].sort(),
    SUPER_CATEGORIES.map((s) => s.slug).slice().sort(),
  );
});

Deno.test("membership totals per super (incl. shared members)", () => {
  const counts: Record<string, number> = {};
  for (const supers of Object.values(ATLAS_CATEGORY_SUPERS)) {
    for (const s of supers) counts[s] = (counts[s] ?? 0) + 1;
  }
  assertEquals(counts, {
    restaurants: 37,
    cafes_bakeries: 9,
    bars_nightlife: 9,
    experiences: 22,
    culture_arts: 6,
    sports_fitness: 12,
    wellness_beauty: 12,
    undefined: 1,
  });
});

Deno.test("the seven doubles carry both parents, catalog order", () => {
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
  assertEquals(familiesForAtlasCategory("winery"), [
    "bars_nightlife",
    "experiences",
  ]);
  assertEquals(familiesForAtlasCategory("board_game_cafe"), [
    "cafes_bakeries",
    "experiences",
  ]);
  assertEquals(familiesForAtlasCategory("movie_theater"), [
    "experiences",
    "culture_arts",
  ]);
});

Deno.test("sports split from beauty: training vs treatment", () => {
  assertEquals(familiesForAtlasCategory("gym"), ["sports_fitness"]);
  assertEquals(familiesForAtlasCategory("padel_club"), ["sports_fitness"]);
  assertEquals(familiesForAtlasCategory("dance_studio"), ["sports_fitness"]);
  assertEquals(familiesForAtlasCategory("spa"), ["wellness_beauty"]);
  assertEquals(familiesForAtlasCategory("barbershop"), ["wellness_beauty"]);
  assertEquals(familiesForAtlasCategory("medical_spa"), ["wellness_beauty"]);
});

Deno.test("undefined category maps to Super undefined; empty has none", () => {
  assertEquals(familiesForAtlasCategory("undefined"), ["undefined"]);
  assertEquals(familiesForAtlasCategory(null), []);
  assertEquals(familiesForAtlasCategory(""), []);
});

Deno.test("familiesForPlace uses FULL Atlas membership, never a stored subset", () => {
  assertEquals(
    familiesForPlace({
      category: "breakfast",
      family_keys: ["cafes_bakeries"],
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
  assertEquals(familiesForPlace({ category: "gastropub" }), ["restaurants"]);
  assertEquals(
    familiesForPlace({
      category: "undefined",
      family_keys: ["bars_nightlife"],
    }),
    ["undefined"],
  );
  assertEquals(familiesForPlace({ category: "undefined" }), ["undefined"]);
});

Deno.test("familiesForPlace is TOTAL — no place is ever pill-less", () => {
  assertEquals(familiesForPlace({ category: "gas_station" }), ["undefined"]);
  assertEquals(familiesForPlace({}), ["undefined"]);
  assertEquals(familiesForPlace({ category: null, family_keys: null }), [
    "undefined",
  ]);
  assertEquals(familiesForPlace({ category: "lol", family_keys: ["nope"] }), [
    "undefined",
  ]);
});

Deno.test("resolveEnrichedFamilyKeys keeps full membership; total fallback", () => {
  assertEquals(
    resolveEnrichedFamilyKeys("mexican", ["restaurants", "bars_nightlife"]),
    ["restaurants"],
  );
  assertEquals(
    resolveEnrichedFamilyKeys("breakfast", ["cafes_bakeries"]),
    ["restaurants", "cafes_bakeries"],
  );
  assertEquals(
    resolveEnrichedFamilyKeys("karaoke", ["experiences"]),
    ["bars_nightlife", "experiences"],
  );
  assertEquals(
    resolveEnrichedFamilyKeys("undefined", ["bars_nightlife"]),
    ["undefined"],
  );
  assertEquals(resolveEnrichedFamilyKeys("undefined", []), ["undefined"]);
  assertEquals(resolveEnrichedFamilyKeys(null, []), ["undefined"]);
  assertEquals(resolveEnrichedFamilyKeys("leftover_slug", ["experiences"]), [
    "experiences",
  ]);
  assertEquals(resolveEnrichedFamilyKeys("leftover_slug", ["junk"]), [
    "undefined",
  ]);
});

Deno.test("sanitizeFamilyKeys drops junk, dedupes, caps at TWO, catalog order", () => {
  assertEquals(
    sanitizeFamilyKeys(["experiences", "restaurants", "restaurants", "nope"]),
    ["restaurants", "experiences"],
  );
  assertEquals(
    sanitizeFamilyKeys(["wellness_beauty", "sports_fitness", "restaurants"]),
    ["restaurants", "sports_fitness"],
  );
  assertEquals(sanitizeFamilyKeys(["a", "b", "c"]), []);
  assertEquals(sanitizeFamilyKeys(null), []);
});

Deno.test("undefined never rides along with a real super", () => {
  assertEquals(sanitizeFamilyKeys(["undefined", "restaurants"]), [
    "restaurants",
  ]);
  assertEquals(sanitizeFamilyKeys(["undefined"]), ["undefined"]);
});

Deno.test("readGuestFamilyKeys keeps every selected Super pill", () => {
  assertEquals(
    readGuestFamilyKeys([
      "experiences",
      "restaurants",
      "restaurants",
      "nope",
      "sports_fitness",
    ]),
    ["restaurants", "experiences", "sports_fitness"],
  );
  assertEquals(readGuestFamilyKeys(["wellness_beauty"]), ["wellness_beauty"]);
  assertEquals(readGuestFamilyKeys(["undefined"]), ["undefined"]);
});
