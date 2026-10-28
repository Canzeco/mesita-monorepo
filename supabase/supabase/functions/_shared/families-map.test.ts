import { assertEquals } from "jsr:@std/assert@1";
import { buildFamiliesMap } from "./families-map.ts";

// MESITA-2891: Atlas lists every Google category exactly once, enabled or not.
Deno.test("every Google category lands in exactly one of the two lists, Undefined is no family", () => {
  const map = buildFamiliesMap(
    [
      { slug: "coffee", label: "Coffee", emoji: "☕", sort_order: 1 },
      { slug: "undefined", label: "Undefined", emoji: "❓", sort_order: 99 },
    ],
    [
      { slug: "gas_station", label: "Gas station", enabled: false },
      { slug: "cafe", label: "Cafe", enabled: true },
      { slug: "bakery", label: "Bakery", enabled: true },
    ],
  );
  assertEquals(map.enabledCategories.map((c) => c.slug), ["bakery", "cafe"]);
  assertEquals(map.disabledCategories.map((c) => c.slug), ["gas_station"]);
  assertEquals(map.families.map((f) => f.slug), ["coffee"]);
});

Deno.test("tags keep the english label and follow facet order", () => {
  const map = buildFamiliesMap([], [], [
    { slug: "late_night", label_es: "Nocturno", label_en: "Late night", facet: "hours", sort_order: 2 },
    { slug: "cash", label_es: "Efectivo", label_en: "Cash", facet: "payment", sort_order: 1 },
    { slug: "card", label_es: "Tarjeta", label_en: "Card", facet: "payment", sort_order: 2 },
  ]);
  assertEquals(map.tags.map((tag) => tag.slug), ["cash", "card", "late_night"]);
  assertEquals(map.tags[0]?.facetLabel, "Payment");
});
