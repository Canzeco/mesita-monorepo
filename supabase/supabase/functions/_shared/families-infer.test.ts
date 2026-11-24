// Mesita Families (MESITA-2891): what the Description step stores. The three
// outcomes that matter — a valid list, a not-enabled category, a useless reply.

import { assertEquals } from "jsr:@std/assert@1";
import {
  FAMILY_MEANINGS,
  familiesRule,
  familiesToStore,
  familyHintLine,
  familyVocabularyLines,
  HINT_FAMILIES,
  mainGoogleCategory,
  pickFamilies,
} from "./families-infer.ts";
import { CATALOG_FAMILY_SLUGS } from "./catalog-families.ts";

const FAMILIES = [
  { slug: "coffee", label: "Coffee", emoji: "☕", sort_order: 1 },
  { slug: "breakfast", label: "Breakfast", emoji: "🍳", sort_order: 2 },
  { slug: "dinner", label: "Dinner", emoji: "🍽️", sort_order: 3 },
  { slug: "drinks", label: "Bar", emoji: "🍻", sort_order: 4 },
  { slug: "fun", label: "Fun", emoji: "🎯", sort_order: 5 },
  { slug: "casino", label: "Casino", emoji: "🎰", sort_order: 6 },
  { slug: "night_out", label: "Night", emoji: "🌙", sort_order: 7 },
  { slug: "sweet", label: "Dessert", emoji: "🍰", sort_order: 8 },
  { slug: "undefined", label: "Undefined", emoji: "❓", sort_order: 99 },
];

Deno.test("pickFamilies: known slugs and salvaged labels, Undefined and junk dropped, at most seven", () => {
  assertEquals(pickFamilies(["coffee", "Bar", "undefined", "nope", "coffee"], FAMILIES), ["coffee", "drinks"]);
  assertEquals(
    pickFamilies(["coffee", "breakfast", "dinner", "drinks", "fun", "casino", "night_out", "sweet"], FAMILIES),
    ["coffee", "breakfast", "dinner", "drinks", "fun", "casino", "night_out"],
  );
});

Deno.test("pickFamilies: nothing usable is null, so the stored list stays", () => {
  assertEquals(pickFamilies(["undefined"], FAMILIES), null);
  assertEquals(pickFamilies("coffee", FAMILIES), null);
  assertEquals(pickFamilies([], FAMILIES), null);
});

Deno.test("familiesToStore: a not-enabled main category stores none, a useless reply keeps the list", () => {
  assertEquals(familiesToStore(["coffee"], true), ["coffee"]);
  assertEquals(familiesToStore(["coffee"], false), null);
  assertEquals(familiesToStore(null, true), undefined);
});

Deno.test("mainGoogleCategory: the first Google category, else the category", () => {
  assertEquals(mainGoogleCategory(["cafe", "bakery"], "bakery"), "cafe");
  assertEquals(mainGoogleCategory([], "bakery"), "bakery");
  assertEquals(mainGoogleCategory(null, "undefined"), null);
});

Deno.test("familyVocabularyLines: a family with a meaning carries it, Undefined is never offered", () => {
  const lines = familyVocabularyLines(FAMILIES);
  assertEquals(lines.some((l) => l.startsWith("coffee — Coffee: ")), true);
  assertEquals(lines.some((l) => l.startsWith("dinner — Dinner: ")), true);
  assertEquals(lines.some((l) => l.startsWith("undefined")), false);
});

// MESITA-4238: every family the model may pick carries a meaning, so no line
// is a bare label the model can read its own way (Family as "kids allowed").
Deno.test("FAMILY_MEANINGS: every catalog family has a meaning", () => {
  const missing = CATALOG_FAMILY_SLUGS.filter((slug) => !FAMILY_MEANINGS[slug]?.trim());
  assertEquals(missing, []);
});

Deno.test("familyVocabularyLines: a live family with no meaning still renders as its label", () => {
  const lines = familyVocabularyLines([{ slug: "brand_new", label: "New", emoji: "✨", sort_order: 1 }]);
  assertEquals(lines, ["brand_new — New"]);
});

// The hint must never nudge the families this fix removes: the code map gives
// Family to family_restaurant, Bar to bar_and_grill, Dinner to every cuisine.
Deno.test("HINT_FAMILIES: no venue or generic family is ever hinted", () => {
  const never = [
    "drinks", "night_out", "fun", "casino",
    "dinner", "fancy", "healthy", "quick_bite", "sweet",
  ];
  assertEquals(never.filter((f) => HINT_FAMILIES.has(f)), []);
});

Deno.test("familyHintLine: cuisines pass, Dinner and Family never do", () => {
  const mexican = familyHintLine(["mexican_restaurant"], null);
  assertEquals(mexican.includes("mexican"), true);
  assertEquals(mexican.includes("dinner"), false);
  assertEquals(familyHintLine(["family_restaurant"], null).includes("family"), false);
  assertEquals(familyHintLine(["bar_and_grill"], null).includes("drinks"), false);
  assertEquals(familyHintLine([], null), "");
});

// MESITA-4581: a stage's Atlas limit caps the pick and the prompt.
Deno.test("pickFamilies and familiesRule obey a stage limit, never past seven", () => {
  assertEquals(pickFamilies(["coffee", "breakfast", "dinner", "drinks"], FAMILIES, 2), ["coffee", "breakfast"]);
  assertEquals(pickFamilies(["coffee", "breakfast", "dinner", "drinks", "fun", "casino", "night_out", "sweet"], FAMILIES, 99)?.length, 7);
  assertEquals(familiesRule("create", 3).includes("never more than 3"), true);
  assertEquals(familiesRule("enrich", 5).includes("never more than 5"), true);
});
