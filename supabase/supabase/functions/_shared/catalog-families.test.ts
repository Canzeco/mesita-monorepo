import { assertEquals } from "jsr:@std/assert@1";
import { familyChips, NO_FAMILY_TYPES, RETIRED_RAIL_TYPES } from "./catalog-families.ts";
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

Deno.test("thirty families: the seven retired rails hold no Google type (MESITA-4571)", () => {
  for (const t of RETIRED_RAIL_TYPES) {
    assertEquals(familiesForGoogleType(t), [], t);
  }
  const gone = ["family", "karaoke", "fun", "cinema", "casino", "spa", "tourist", "go_out"];
  const stillThere = Object.keys(GOOGLE_TYPE_SUPER).filter((t) =>
    (familiesForGoogleType(t) as string[]).some((f) => gone.includes(f))
  );
  assertEquals(stillThere, []);
  // What stays a trip keeps its food and drink rails.
  assertEquals(familiesForGoogleType("family_restaurant"), ["dinner"]);
  assertEquals(familiesForGoogleType("karaoke"), ["drinks", "night_out"]);
  assertEquals(familiesForGoogleType("comedy_club"), ["night_out"]);
  assertEquals(familiesForGoogleType("billiards"), ["drinks"]);
  assertEquals(familiesForGoogleType("board_game_cafe"), ["coffee"]);
});

Deno.test("sixteen rails folded into their parent (MESITA-2888)", () => {
  assertEquals(familiesForGoogleType("brunch_restaurant"), ["breakfast"]);
  assertEquals(familiesForGoogleType("ice_cream_shop"), ["sweet"]);
  assertEquals(familiesForGoogleType("vegan_restaurant"), ["healthy"]);
  assertEquals(familiesForGoogleType("sandwich_shop"), ["quick_bite"]);
  assertEquals(familiesForGoogleType("chicken_wings_restaurant"), ["chicken", "sports"]);
  assertEquals(familiesForGoogleType("kebab_shop"), ["quick_bite", "arabic"]);
  assertEquals(familiesForGoogleType("barbecue_restaurant"), ["dinner", "steak"]);
  assertEquals(familiesForGoogleType("ramen_restaurant"), ["japanese"]);
  assertEquals(familiesForGoogleType("dumpling_restaurant"), ["chinese"]);
  assertEquals(familiesForGoogleType("korean_restaurant"), ["dinner", "asian"]);
  assertEquals(familiesForGoogleType("thai_restaurant"), ["dinner", "asian"]);
  assertEquals(familiesForGoogleType("greek_restaurant"), ["dinner", "arabic"]);
  assertEquals(familiesForGoogleType("spanish_restaurant"), ["dinner", "european"]);
  assertEquals(familiesForGoogleType("french_restaurant"), ["dinner", "european"]);
  assertEquals(familiesForGoogleType("latin_american_restaurant"), ["dinner"]);
  assertEquals(familiesForGoogleType("argentinian_restaurant"), ["dinner", "steak"]);
});

Deno.test("a place's families are every family of its categories, none primary (MESITA-2808)", () => {
  // Order means nothing: the result is always in the catalog's family order.
  assertEquals(placeFamilies("pizza_restaurant", ["pizza_restaurant", "italian_restaurant", "restaurant", "food"]), [
    "dinner",
    "italian",
    "pizza",
  ]);
  assertEquals(
    placeFamilies("cafe", ["cafe", "bakery", "bar", "ice_cream_shop"]),
    ["coffee", "drinks", "breakfast", "sweet", "bakery"],
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
