import { assertEquals } from "jsr:@std/assert";
import {
  ATLAS_CATEGORY_FAMILIES,
  FAMILIES,
  familiesForAtlasCategory,
  familiesForPlace,
  readGuestFamilyKeys,
  resolveEnrichedFamilyKeys,
  sanitizeFamilyKeys,
} from "./place-taxonomy.ts";

Deno.test("place family catalog is fifteen guest families, Undefined last", () => {
  assertEquals(FAMILIES.length, 16);
  assertEquals(FAMILIES.map((s) => s.slug), [
    "coffee",
    "breakfast",
    "quick_bite",
    "pizza",
    "tacos",
    "sushi",
    "burgers",
    "noodles",
    "dinner",
    "sweet",
    "drinks",
    "night_out",
    "go_out",
    "move",
    "feel_better",
    "undefined",
  ]);
  const last = FAMILIES[FAMILIES.length - 1]!;
  assertEquals(last.slug, "undefined");
  assertEquals(last.label, "Undefined");
  assertEquals(last.sort_order, 999);
});

Deno.test("every Atlas category maps onto the fifteen; five sit on two", () => {
  const slugs = Object.keys(ATLAS_CATEGORY_FAMILIES);
  assertEquals(slugs.length, 101);
  assertEquals(slugs.includes("undefined"), true);
  const covered = new Set<string>();
  const doubles: string[] = [];
  for (const slug of slugs) {
    const families = ATLAS_CATEGORY_FAMILIES[slug] ?? [];
    if (families.length < 1 || families.length > 20) {
      throw new Error(`${slug} has ${families.length} families`);
    }
    if (families.length === 2) doubles.push(slug);
    for (const s of families) covered.add(s);
  }
  assertEquals(doubles.sort(), [
    "bakery",
    "board_game_cafe",
    "cafe",
    "coffee_shop",
    "karaoke",
  ]);
  assertEquals(covered.has("undefined"), true);
  assertEquals(covered.has("pizza"), true);
  assertEquals(covered.has("dinner"), true);
});

Deno.test("a cafe is coffee and breakfast; a pizzeria is only pizza", () => {
  assertEquals(familiesForAtlasCategory("breakfast"), ["breakfast"]);
  assertEquals(familiesForAtlasCategory("brunch"), ["breakfast"]);
  assertEquals(familiesForAtlasCategory("cafe"), ["coffee", "breakfast"]);
  assertEquals(familiesForAtlasCategory("karaoke"), ["night_out", "go_out"]);
  assertEquals(familiesForAtlasCategory("winery"), ["drinks"]);
  assertEquals(familiesForAtlasCategory("pizza"), ["pizza"]);
  assertEquals(familiesForAtlasCategory("movie_theater"), ["go_out"]);
});

Deno.test("training is Move and a spa is Feel better", () => {
  assertEquals(familiesForAtlasCategory("gym"), ["move"]);
  assertEquals(familiesForAtlasCategory("padel_club"), ["move"]);
  assertEquals(familiesForAtlasCategory("spa"), ["feel_better"]);
  assertEquals(familiesForAtlasCategory("barbershop"), ["feel_better"]);
});

Deno.test("undefined category maps to family undefined; empty has none", () => {
  assertEquals(familiesForAtlasCategory("undefined"), ["undefined"]);
  assertEquals(familiesForAtlasCategory(null), []);
  assertEquals(familiesForAtlasCategory(""), []);
});

Deno.test("familiesForPlace uses the mapping on the row, else the catalog trip", () => {
  assertEquals(
    familiesForPlace({
      category: "breakfast",
      family_keys: ["coffee"],
    }),
    ["coffee"],
  );
  assertEquals(
    familiesForPlace({
      category: "mexican",
      family_keys: ["drinks"],
    }),
    ["drinks"],
  );
  assertEquals(familiesForPlace({ category: "mexican" }), ["tacos"]);
  assertEquals(familiesForPlace({ category: "gastropub" }), ["dinner", "drinks"]);
  assertEquals(
    familiesForPlace({
      category: "undefined",
      family_keys: ["drinks"],
    }),
    ["drinks"],
  );
  assertEquals(familiesForPlace({ category: "undefined" }), ["undefined"]);
  assertEquals(familiesForPlace({ category: "cafe" }), ["coffee", "breakfast"]);
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

Deno.test("resolveEnrichedFamilyKeys keeps the catalog trip", () => {
  assertEquals(resolveEnrichedFamilyKeys("mexican", ["dinner"]), ["tacos"]);
  assertEquals(resolveEnrichedFamilyKeys("breakfast", ["coffee"]), ["breakfast"]);
  assertEquals(resolveEnrichedFamilyKeys("karaoke", ["go_out"]), [
    "night_out",
    "go_out",
  ]);
  assertEquals(resolveEnrichedFamilyKeys("mexican_restaurant", ["dinner"]), [
    "tacos",
  ]);
  assertEquals(resolveEnrichedFamilyKeys("undefined", ["drinks"]), ["undefined"]);
  assertEquals(resolveEnrichedFamilyKeys("undefined", []), ["undefined"]);
  assertEquals(resolveEnrichedFamilyKeys(null, []), ["undefined"]);
  assertEquals(resolveEnrichedFamilyKeys("leftover_slug", ["dinner"]), ["dinner"]);
  assertEquals(resolveEnrichedFamilyKeys("leftover_slug", ["junk"]), ["undefined"]);
});

Deno.test("sanitizeFamilyKeys drops junk, dedupes, keeps more than two, catalog order", () => {
  assertEquals(
    sanitizeFamilyKeys(["go_out", "dinner", "dinner", "nope"]),
    ["dinner", "go_out"],
  );
  assertEquals(
    sanitizeFamilyKeys(["feel_better", "move", "dinner"]),
    ["dinner", "move", "feel_better"],
  );
  assertEquals(sanitizeFamilyKeys(["a", "b", "c"]), []);
  assertEquals(sanitizeFamilyKeys(null), []);
});

Deno.test("undefined never rides along with a real family", () => {
  assertEquals(sanitizeFamilyKeys(["undefined", "dinner"]), ["dinner"]);
  assertEquals(sanitizeFamilyKeys(["undefined"]), ["undefined"]);
});

Deno.test("readGuestFamilyKeys keeps every selected family pill", () => {
  assertEquals(
    readGuestFamilyKeys(["go_out", "dinner", "dinner", "nope", "move"]),
    ["dinner", "go_out", "move"],
  );
  assertEquals(readGuestFamilyKeys(["feel_better"]), ["feel_better"]);
  assertEquals(readGuestFamilyKeys(["undefined"]), ["undefined"]);
});
