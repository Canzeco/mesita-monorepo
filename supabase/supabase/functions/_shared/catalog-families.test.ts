import { assertEquals } from "jsr:@std/assert@1";
import { ATTRACTION_TYPES, familiesPrimaryFirst, NOT_SOCIAL_TYPES } from "./catalog-families.ts";
import { placeFamilies, primaryFamilyForGoogleType, familiesForGoogleType } from "./sourcing.ts";
import { GOOGLE_TYPE_SUPER } from "./google-type-super.ts";

Deno.test("OpenTable scope: every attraction sits in no family (MESITA-2438)", () => {
  for (const t of ATTRACTION_TYPES) {
    assertEquals(familiesForGoogleType(t), [], t);
    assertEquals(primaryFamilyForGoogleType(t), null, t);
  }
});

Deno.test("Go out keeps only what a guest books a slot at: karaoke on Google's side", () => {
  const onGoOut = Object.keys(GOOGLE_TYPE_SUPER).filter((t) => familiesForGoogleType(t).includes("go_out"));
  assertEquals(onGoOut, ["karaoke"]);
  // No unlisted culture or experiences type falls back onto a rail.
  for (const [slug, coarse] of Object.entries(GOOGLE_TYPE_SUPER)) {
    if (coarse !== "culture_arts" && coarse !== "experiences") continue;
    for (const f of familiesForGoogleType(slug)) assertEquals(["go_out", "night_out"].includes(f), false, `${slug} → ${f}`);
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
    assertEquals(primaryFamilyForGoogleType(t), null, t);
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

Deno.test("primary first: a row's own order, not the catalog's", () => {
  assertEquals(familiesPrimaryFirst("cafe", "cafes_bakeries"), ["coffee", "breakfast"]);
  assertEquals(familiesPrimaryFirst("bakery", "cafes_bakeries"), ["sweet", "breakfast"]);
  assertEquals(familiesPrimaryFirst("brewpub", "bars_nightlife"), ["drinks", "dinner"]);
  assertEquals(primaryFamilyForGoogleType("gastropub"), "drinks");
  assertEquals(primaryFamilyForGoogleType("italian_restaurant"), "dinner");
});

Deno.test("placeFamilies: one primary from primaryType, at most two secondary from types[]", () => {
  assertEquals(placeFamilies("pizza_restaurant", ["pizza_restaurant", "italian_restaurant", "restaurant", "food"]), {
    primary: "pizza",
    secondary: ["dinner"],
    keys: ["pizza", "dinner"],
  });
  // The bare `restaurant` umbrella never makes a secondary Dinner.
  assertEquals(placeFamilies("taco_restaurant", ["taco_restaurant", "restaurant"]).secondary, []);
  // A cafe's own second family counts first; the cap is two.
  assertEquals(
    placeFamilies("cafe", ["cafe", "bakery", "bar", "ice_cream_shop"]).keys,
    ["coffee", "breakfast", "sweet"],
  );
  // A primary type in no family: no families at all.
  assertEquals(placeFamilies("museum", ["museum", "cafe"]).keys, []);
  assertEquals(placeFamilies(null, ["cafe"]).keys, []);
});
