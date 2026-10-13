import { assertEquals } from "jsr:@std/assert@1";
import type { PlaceCategory, PlaceFamily } from "./categories.ts";
import {
  categoriesWithFamilyDisplay,
  resolveProfileFamily,
  resolveStoredFamily,
} from "./profile-family.ts";

const families: PlaceFamily[] = [
  { slug: "bars_nightlife", label: "Bars & Nightlife", emoji: "🍸", sort_order: 3 },
  { slug: "experiences", label: "Experiences", emoji: "🎟️", sort_order: 4 },
  { slug: "undefined", label: "Undefined", emoji: "❓", sort_order: 8 },
];

const categories: PlaceCategory[] = [
  {
    slug: "nightclub",
    label: "Nightclub",
    section: "Nightlife",
    sort_order: 1,
    family_keys: ["bars_nightlife"],
  },
  {
    slug: "karaoke",
    label: "Karaoke",
    section: "Nightlife",
    sort_order: 2,
    family_keys: ["bars_nightlife", "experiences"],
  },
  {
    slug: "undefined",
    label: "Undefined",
    section: "Other",
    sort_order: 99,
    family_keys: ["undefined"],
  },
];

Deno.test("a defined category resolves to its full membership", () => {
  assertEquals(
    resolveProfileFamily({
      category: "nightclub",
      familyKeys: ["restaurants"],
      categories,
      families,
    }),
    { text: "🍸 Bars & Nightlife", inferred: false },
  );
});

Deno.test("a multi-parent category joins both families", () => {
  assertEquals(
    resolveProfileFamily({
      category: "karaoke",
      familyKeys: null,
      categories,
      families,
    }).text,
    "🍸 Bars & Nightlife · 🎟️ Experiences",
  );
});

Deno.test("undefined category shows stored keys as inferred", () => {
  assertEquals(
    resolveProfileFamily({
      category: "undefined",
      familyKeys: ["bars_nightlife"],
      categories,
      families,
    }),
    { text: "🍸 Bars & Nightlife", inferred: true },
  );
});

Deno.test("nothing known falls through to Undefined", () => {
  assertEquals(
    resolveStoredFamily(null, families),
    { text: "❓ Undefined", inferred: false },
  );
  assertEquals(
    resolveProfileFamily({
      category: null,
      familyKeys: ["undefined"],
      categories,
      families,
    }),
    { text: "❓ Undefined", inferred: false },
  );
});

Deno.test("an unknown category falls through to stored keys", () => {
  assertEquals(
    resolveProfileFamily({
      category: "not_a_category",
      familyKeys: ["experiences"],
      categories,
      families,
    }),
    { text: "🎟️ Experiences", inferred: true },
  );
});

Deno.test("each category option carries its family display", () => {
  const options = categoriesWithFamilyDisplay(categories, families);
  assertEquals(options.find((c) => c.slug === "karaoke")?.family_display, "🍸 Bars & Nightlife · 🎟️ Experiences");
  assertEquals(options.find((c) => c.slug === "undefined")?.family_display, "❓ Undefined");
});
