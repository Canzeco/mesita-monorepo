import { assertEquals } from "jsr:@std/assert@1";
import { ATTRACTION_TYPES, NOT_SOCIAL_TYPES } from "./catalog-families.ts";
import { placeFamilies, familiesForGoogleType } from "./sourcing.ts";
import { GOOGLE_TYPE_SUPER } from "./google-type-super.ts";

Deno.test("OpenTable scope: every attraction sits in no family (MESITA-2438)", () => {
  for (const t of ATTRACTION_TYPES) {
    assertEquals(familiesForGoogleType(t), [], t);
    assertEquals(familiesForGoogleType(t), [], t);
  }
});

Deno.test("Go out folded into Night out: karaoke is Nightlife and its own rail (MESITA-2486, 2834)", () => {
  const onGoOut = Object.keys(GOOGLE_TYPE_SUPER).filter((t) => (familiesForGoogleType(t) as string[]).includes("go_out"));
  assertEquals(onGoOut, []);
  assertEquals(familiesForGoogleType("karaoke"), ["night_out", "karaoke"]);
  // No unlisted culture or experiences type falls back onto a rail.
  for (const [slug, coarse] of Object.entries(GOOGLE_TYPE_SUPER)) {
    if (coarse !== "culture_arts" && coarse !== "experiences") continue;
    for (const f of familiesForGoogleType(slug)) assertEquals(f === "night_out", false, `${slug} → ${f}`);
  }
});

Deno.test("the migration moves the stored mapping with the code (MESITA-2438)", async () => {
  const sql = await Deno.readTextFile(
    new URL("../../migrations/20261020000000_families_opentable_scope.sql", import.meta.url),
  );
  const block = sql.match(/-- ATTRACTIONS\n([\s\S]*?)-- END ATTRACTIONS/);
  if (!block) throw new Error("no ATTRACTIONS block in the migration");
  const slugs = [...block[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  assertEquals(slugs, [...ATTRACTION_TYPES]);
});

Deno.test("social: no gym, studio, court, spa, salon or barber sits in a family (MESITA-2468)", () => {
  for (const t of NOT_SOCIAL_TYPES) {
    assertEquals(familiesForGoogleType(t), [], t);
    assertEquals(familiesForGoogleType(t), [], t);
  }
  // No unlisted sport or wellness type falls back onto a rail.
  for (const [slug, coarse] of Object.entries(GOOGLE_TYPE_SUPER)) {
    if (coarse !== "sports_fitness" && coarse !== "wellness_beauty") continue;
    assertEquals(familiesForGoogleType(slug), [], slug);
  }
});

Deno.test("the migration moves the not-social mapping with the code (MESITA-2468)", async () => {
  const sql = await Deno.readTextFile(
    new URL("../../migrations/20261020030000_families_drop_move_feel_better.sql", import.meta.url),
  );
  const block = sql.match(/-- NOT SOCIAL\n([\s\S]*?)-- END NOT SOCIAL/);
  if (!block) throw new Error("no NOT SOCIAL block in the migration");
  const slugs = [...block[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  assertEquals(slugs, [...NOT_SOCIAL_TYPES]);
});

Deno.test("a place's families are every family of its categories, none primary (MESITA-2808)", () => {
  // Order means nothing: the result is always in the catalog's family order.
  assertEquals(placeFamilies("pizza_restaurant", ["pizza_restaurant", "italian_restaurant", "restaurant", "food"]), [
    "pizza",
    "dinner",
    "italian",
  ]);
  assertEquals(
    placeFamilies("cafe", ["cafe", "bakery", "bar", "ice_cream_shop"]),
    ["coffee", "breakfast", "brunch", "bakery", "sweet", "gelato", "drinks"],
  );
  // The bare `restaurant` umbrella adds nothing.
  assertEquals(placeFamilies("breakfast_restaurant", ["breakfast_restaurant", "restaurant"]), ["breakfast", "brunch"]);
  // A primary type in no family: no families at all.
  assertEquals(placeFamilies("museum", ["museum", "cafe"]), []);
  assertEquals(placeFamilies(null, ["cafe"]), []);
});
