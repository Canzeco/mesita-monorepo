import { assert, assertEquals } from "jsr:@std/assert@1";
import { buildFamiliesMap } from "./families-map.ts";
import { GOOGLE_TYPE_SUPER } from "./google-type-super.ts";

Deno.test("google types stay exclusive and never land on undefined", () => {
  const map = buildFamiliesMap([], []);
  const slugs = map.googleTypes.map((t) => t.slug);
  assertEquals(new Set(slugs).size, slugs.length);
  assertEquals(slugs.length, Object.keys(GOOGLE_TYPE_SUPER).length);
  assert(map.googleTypes.some((t) => t.family === "other"));
  assert(!map.googleTypes.some((t) => (t.family as string) === "undefined"));
});

Deno.test("a category keeps both family keys and does not invent a third", () => {
  const map = buildFamiliesMap(
    [{ slug: "restaurants", label: "Restaurants", emoji: "🍽️", sort_order: 1 }],
    [{
      slug: "brunch",
      label: "Brunch",
      section: "food",
      sort_order: 2,
      family_keys: ["restaurants", "cafes_bakeries"],
    }],
  );
  assertEquals(map.categories[0]?.familyKeys, ["restaurants", "cafes_bakeries"]);
  assertEquals(map.families[0]?.slug, "restaurants");
});
