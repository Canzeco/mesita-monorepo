import { assertEquals } from "jsr:@std/assert";
import {
  FAMILIES,
  familiesForPlace,
  keepAtlasValues,
  readGuestFamilyKeys,
  resolveEnrichedFamilyKeys,
  sanitizeFamilyKeys,
} from "./place-taxonomy.ts";

Deno.test("place family catalog is thirty-seven guest families, Undefined last", () => {
  assertEquals(FAMILIES.length, 38);
  assertEquals(FAMILIES.map((s) => s.slug), [
    "coffee",
    "breakfast",
    "bakery",
    "sweet",
    "healthy",
    "quick_bite",
    "tacos",
    "burgers",
    "pizza",
    "chicken",
    "sushi",
    "mexican",
    "steak",
    "seafood",
    "italian",
    "japanese",
    "chinese",
    "asian",
    "indian",
    "arabic",
    "european",
    "american",
    "dinner",
    "fancy",
    "family",
    "drinks",
    "sports",
    "hookah",
    "night_out",
    "nightclub",
    "music",
    "karaoke",
    "fun",
    "cinema",
    "casino",
    "spa",
    "tourist",
    "undefined",
  ]);
  const last = FAMILIES[FAMILIES.length - 1]!;
  assertEquals(last.slug, "undefined");
  assertEquals(last.label, "Undefined");
  assertEquals(last.sort_order, 999);
});

Deno.test("familiesForPlace follows the mapping or the stored keys", () => {
  assertEquals(familiesForPlace({ category: "mexican" }), ["undefined"]);
  assertEquals(
    familiesForPlace({
      category: "breakfast",
      family_keys: ["coffee"],
    }),
    ["coffee"],
  );
  assertEquals(
    familiesForPlace(
      { category: "mexican", family_keys: ["mexican"] },
      { mexican: ["dinner"] },
    ),
    ["dinner"],
  );
  assertEquals(
    familiesForPlace({ category: "cafe" }, { cafe: ["coffee", "breakfast"] }),
    ["coffee", "breakfast"],
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

Deno.test("resolveEnrichedFamilyKeys ignores a family the model invented", () => {
  const mapping = {
    mexican: ["mexican"],
    board_game_cafe: ["coffee", "fun"],
  };
  assertEquals(resolveEnrichedFamilyKeys("mexican", ["dinner"], mapping), ["mexican"]);
  assertEquals(
    resolveEnrichedFamilyKeys("board_game_cafe", ["invented_family"], mapping),
    ["coffee", "fun"],
  );
  assertEquals(resolveEnrichedFamilyKeys("mexican", ["dinner"]), ["undefined"]);
  assertEquals(resolveEnrichedFamilyKeys("leftover_slug", ["dinner"]), ["undefined"]);
  assertEquals(resolveEnrichedFamilyKeys(null, ["dinner"], mapping), ["undefined"]);
});

Deno.test("keepAtlasValues drops a category and tags Atlas does not define", () => {
  assertEquals(
    keepAtlasValues({
      category: "invented_bistro",
      tags: ["terraza", "made_up", "terraza", "desayuno"],
      categories: ["mexican", "undefined"],
      tagVocabulary: ["terraza", "desayuno"],
    }),
    { category: "undefined", tags: ["terraza", "desayuno"] },
  );
  assertEquals(
    keepAtlasValues({
      category: "Mexican",
      tags: ["desayuno"],
      categories: ["mexican"],
      tagVocabulary: ["desayuno"],
    }),
    { category: "mexican", tags: ["desayuno"] },
  );
});

Deno.test("sanitizeFamilyKeys drops junk, dedupes, keeps more than two, catalog order", () => {
  assertEquals(
    sanitizeFamilyKeys(["night_out", "dinner", "dinner", "nope", "go_out"]),
    ["dinner", "night_out"],
  );
  assertEquals(
    sanitizeFamilyKeys(["night_out", "drinks", "dinner"]),
    ["dinner", "drinks", "night_out"],
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
    readGuestFamilyKeys(["night_out", "dinner", "dinner", "nope", "move", "go_out"]),
    ["dinner", "night_out"],
  );
  assertEquals(readGuestFamilyKeys(["feel_better"]), []);
  assertEquals(readGuestFamilyKeys(["undefined"]), ["undefined"]);
});
