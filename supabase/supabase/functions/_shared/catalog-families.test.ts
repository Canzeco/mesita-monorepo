import { assertEquals } from "jsr:@std/assert@1";
import { familyChips, NO_FAMILY_TYPES } from "./catalog-families.ts";
import { placeFamilies, familiesForGoogleType } from "./sourcing.ts";
import { GOOGLE_TYPE_SUPER } from "./google-type-super.ts";

Deno.test("not social: no gym, court, studio, salon or barber sits in a family (MESITA-2468, kept by MESITA-2888)", () => {
  for (const t of NO_FAMILY_TYPES) {
    assertEquals(familiesForGoogleType(t), [], t);
  }
  // No unlisted sport, wellness, culture or experiences type falls back onto
  // a rail: every one that is a rail has its own row.
  for (const [slug, coarse] of Object.entries(GOOGLE_TYPE_SUPER)) {
    if (!["sports_fitness", "wellness_beauty", "culture_arts", "experiences"].includes(coarse)) continue;
    const families = familiesForGoogleType(slug);
    if (families.length === 0) continue;
    assertEquals(families.includes("undefined" as never), false, slug);
  }
});

Deno.test("the six rails past the table (MESITA-2888)", () => {
  assertEquals(familiesForGoogleType("tourist_attraction"), ["tourist"]);
  assertEquals(familiesForGoogleType("museum"), ["tourist"]);
  assertEquals(familiesForGoogleType("zoo"), ["family", "tourist"]);
  assertEquals(familiesForGoogleType("bowling_alley"), ["fun"]);
  assertEquals(familiesForGoogleType("golf_course"), ["fun"]);
  assertEquals(familiesForGoogleType("movie_theater"), ["cinema"]);
  assertEquals(familiesForGoogleType("comedy_club"), ["night_out", "cinema"]);
  assertEquals(familiesForGoogleType("casino"), ["casino"]);
  assertEquals(familiesForGoogleType("spa"), ["spa"]);
  assertEquals(familiesForGoogleType("family_restaurant"), ["dinner", "family"]);
  // Go out folded into Night (MESITA-2486); karaoke is Night and its own rail.
  const onGoOut = Object.keys(GOOGLE_TYPE_SUPER).filter((t) => (familiesForGoogleType(t) as string[]).includes("go_out"));
  assertEquals(onGoOut, []);
  assertEquals(familiesForGoogleType("karaoke"), ["night_out", "karaoke"]);
});

Deno.test("sixteen rails folded into their parent (MESITA-2888)", () => {
  assertEquals(familiesForGoogleType("brunch_restaurant"), ["breakfast"]);
  assertEquals(familiesForGoogleType("ice_cream_shop"), ["sweet"]);
  assertEquals(familiesForGoogleType("vegan_restaurant"), ["healthy"]);
  assertEquals(familiesForGoogleType("sandwich_shop"), ["quick_bite"]);
  assertEquals(familiesForGoogleType("chicken_wings_restaurant"), ["chicken", "sports"]);
  assertEquals(familiesForGoogleType("kebab_shop"), ["quick_bite", "arabic"]);
  assertEquals(familiesForGoogleType("barbecue_restaurant"), ["steak", "dinner"]);
  assertEquals(familiesForGoogleType("ramen_restaurant"), ["japanese"]);
  assertEquals(familiesForGoogleType("dumpling_restaurant"), ["chinese"]);
  assertEquals(familiesForGoogleType("korean_restaurant"), ["asian", "dinner"]);
  assertEquals(familiesForGoogleType("thai_restaurant"), ["asian", "dinner"]);
  assertEquals(familiesForGoogleType("greek_restaurant"), ["arabic", "dinner"]);
  assertEquals(familiesForGoogleType("spanish_restaurant"), ["european", "dinner"]);
  assertEquals(familiesForGoogleType("french_restaurant"), ["european", "dinner"]);
  assertEquals(familiesForGoogleType("latin_american_restaurant"), ["dinner"]);
  assertEquals(familiesForGoogleType("argentinian_restaurant"), ["steak", "dinner"]);
});

Deno.test("a place's families are every family of its categories, none primary (MESITA-2808)", () => {
  // Order means nothing: the result is always in the catalog's family order.
  assertEquals(placeFamilies("pizza_restaurant", ["pizza_restaurant", "italian_restaurant", "restaurant", "food"]), [
    "pizza",
    "italian",
    "dinner",
  ]);
  assertEquals(
    placeFamilies("cafe", ["cafe", "bakery", "bar", "ice_cream_shop"]),
    ["coffee", "breakfast", "bakery", "sweet", "drinks"],
  );
  // The bare `restaurant` umbrella adds nothing.
  assertEquals(placeFamilies("breakfast_restaurant", ["breakfast_restaurant", "restaurant"]), ["breakfast"]);
  // A primary type in no family: no families at all.
  assertEquals(placeFamilies("gas_station", ["gas_station", "cafe"]), []);
  assertEquals(placeFamilies(null, ["cafe"]), []);
});

Deno.test("the Families box: Undefined is no family, so no families draws no box (MESITA-2954)", () => {
  // The profiles view reads an empty list as ['undefined'].
  assertEquals(familyChips(["undefined"]), []);
  assertEquals(familyChips([]), []);
  assertEquals(familyChips(null), []);
  assertEquals(familyChips(["undefined", "coffee"]).map((f) => f.key), ["coffee"]);
});
