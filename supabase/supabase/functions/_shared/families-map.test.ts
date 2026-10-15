import { assert, assertEquals } from "jsr:@std/assert@1";
import { buildFamiliesMap } from "./families-map.ts";
import { GOOGLE_TYPE_SUPER } from "./google-type-super.ts";

Deno.test("google types stay exclusive and leftovers land on undefined", () => {
  const map = buildFamiliesMap([], []);
  const slugs = map.googleTypes.map((t) => t.slug);
  assertEquals(new Set(slugs).size, slugs.length);
  assertEquals(slugs.length, Object.keys(GOOGLE_TYPE_SUPER).length);
  assert(map.googleTypes.some((t) => t.family === "undefined"));
  assert(!map.googleTypes.some((t) => (t.family as string) === "other"));
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
  assertEquals(map.categories[0]?.familyKeys, [
    "restaurants",
    "cafes_bakeries",
  ]);
  assertEquals(map.families[0]?.slug, "restaurants");
  assertEquals(map.tags, []);
});

Deno.test("tags keep the english label and follow facet order", () => {
  const map = buildFamiliesMap([], [], [
    {
      slug: "late_night",
      label_es: "Nocturno",
      label_en: "Late night",
      facet: "hours",
      sort_order: 2,
    },
    {
      slug: "cash",
      label_es: "Efectivo",
      label_en: "Cash",
      facet: "payment",
      sort_order: 1,
    },
    {
      slug: "card",
      label_es: "Tarjeta",
      label_en: "Card",
      facet: "payment",
      sort_order: 2,
    },
  ]);
  assertEquals(map.tags.map((tag) => tag.slug), ["cash", "card", "late_night"]);
  assertEquals(map.tags[0]?.label, "Cash");
  assertEquals(map.tags[0]?.facetLabel, "Payment");
  assertEquals(map.tags[0]?.facetEmoji, "💳");
  assertEquals(map.tags[2]?.facetLabel, "Hours");
});
