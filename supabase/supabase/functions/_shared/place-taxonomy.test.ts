import { assertEquals } from "jsr:@std/assert";
import {
  ATLAS_CATEGORY_FAMILIES,
  FAMILIES,
  familiesForAtlasCategory,
  familiesForPlace,
  keepAtlasValues,
  readGuestFamilyKeys,
  resolveEnrichedFamilyKeys,
  sanitizeFamilyKeys,
} from "./place-taxonomy.ts";

Deno.test("place family catalog is fifty guest families, Undefined last", () => {
  assertEquals(FAMILIES.length, 51);
  assertEquals(FAMILIES.map((s) => s.slug), [
    "coffee",
    "breakfast",
    "brunch",
    "bakery",
    "sweet",
    "gelato",
    "healthy",
    "vegan",
    "quick_bite",
    "tacos",
    "burgers",
    "pizza",
    "sandwiches",
    "chicken",
    "wings",
    "kebab",
    "dinner",
    "mexican",
    "steak",
    "bbq",
    "seafood",
    "italian",
    "sushi",
    "japanese",
    "ramen",
    "noodles",
    "chinese",
    "dumplings",
    "korean",
    "thai",
    "indian",
    "asian",
    "arabic",
    "mediterranean",
    "spanish",
    "french",
    "european",
    "american",
    "latin",
    "fancy",
    "drinks",
    "beer",
    "cocktails",
    "wine",
    "sports",
    "hookah",
    "night_out",
    "nightclub",
    "music",
    "karaoke",
    "undefined",
  ]);
  const last = FAMILIES[FAMILIES.length - 1]!;
  assertEquals(last.slug, "undefined");
  assertEquals(last.label, "Undefined");
  assertEquals(last.sort_order, 999);
});

Deno.test("every Atlas category maps onto the fifty; twenty-four sit on two", () => {
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
    "billiards",
    "board_game_cafe",
    "breakfast",
    "brewery",
    "brunch",
    "chinese",
    "coffee_shop",
    "deli",
    "ice_cream",
    "indian",
    "italian",
    "juice_bar",
    "karaoke",
    "korean",
    "night_club",
    "pizza",
    "pub",
    "salad",
    "sandwich",
    "seafood",
    "steak_house",
    "sushi",
    "thai",
    "wine_bar",
  ]);
  assertEquals(covered.has("undefined"), true);
  assertEquals(covered.has("pizza"), true);
  assertEquals(covered.has("dinner"), true);
});

Deno.test("a cafe is coffee and breakfast; a pizzeria is pizza and italian", () => {
  assertEquals(familiesForAtlasCategory("breakfast"), ["breakfast", "brunch"]);
  assertEquals(familiesForAtlasCategory("brunch"), ["breakfast", "brunch"]);
  assertEquals(familiesForAtlasCategory("cafe"), ["coffee", "breakfast", "brunch"]);
  assertEquals(familiesForAtlasCategory("karaoke"), ["night_out", "karaoke"]);
  assertEquals(familiesForAtlasCategory("winery"), ["wine"]);
  // Catalog order, not primary-first: quick_bite and tacos sort before mexican,
  // and Dinner opens its phase, so it sorts before every cuisine (MESITA-2834).
  assertEquals(familiesForAtlasCategory("pizza"), ["pizza", "italian"]);
  assertEquals(familiesForAtlasCategory("mexican"), ["tacos", "dinner", "mexican"]);
  assertEquals(familiesForAtlasCategory("taco"), ["quick_bite", "tacos", "mexican"]);
  assertEquals(familiesForAtlasCategory("thai"), ["dinner", "thai"]);
  // An attraction is in no family (MESITA-2438).
  assertEquals(familiesForAtlasCategory("movie_theater"), ["undefined"]);
});

Deno.test("a gym, a padel club, a spa and a barbershop are in no family (MESITA-2468)", () => {
  assertEquals(familiesForAtlasCategory("gym"), ["undefined"]);
  assertEquals(familiesForAtlasCategory("padel_club"), ["undefined"]);
  assertEquals(familiesForAtlasCategory("spa"), ["undefined"]);
  assertEquals(familiesForAtlasCategory("barbershop"), ["undefined"]);
});

Deno.test("undefined category maps to family undefined; empty has none", () => {
  assertEquals(familiesForAtlasCategory("undefined"), ["undefined"]);
  assertEquals(familiesForAtlasCategory(null), []);
  assertEquals(familiesForAtlasCategory(""), []);
});

Deno.test("familiesForPlace follows the mapping, not the code twin", () => {
  assertEquals(familiesForAtlasCategory("mexican"), ["tacos", "dinner", "mexican"]);
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
    board_game_cafe: ["coffee", "night_out"],
  };
  assertEquals(resolveEnrichedFamilyKeys("mexican", ["dinner"], mapping), ["mexican"]);
  assertEquals(
    resolveEnrichedFamilyKeys("board_game_cafe", ["invented_family"], mapping),
    ["coffee", "night_out"],
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
