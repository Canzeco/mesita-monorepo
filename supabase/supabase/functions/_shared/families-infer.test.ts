// Mesita Families (MESITA-2891): what the Description step stores. The three
// outcomes that matter — a valid list, a not-enabled category, a useless reply.

import { assertEquals } from "jsr:@std/assert@1";
import { familiesToStore, mainGoogleCategory, pickFamilies } from "./families-infer.ts";

const FAMILIES = [
  { slug: "coffee", label: "Coffee", emoji: "☕", sort_order: 1 },
  { slug: "breakfast", label: "Breakfast", emoji: "🍳", sort_order: 2 },
  { slug: "dinner", label: "Dinner", emoji: "🍽️", sort_order: 3 },
  { slug: "drinks", label: "Bar", emoji: "🍻", sort_order: 4 },
  { slug: "fun", label: "Fun", emoji: "🎯", sort_order: 5 },
  { slug: "spa", label: "Spa", emoji: "🧖", sort_order: 6 },
  { slug: "undefined", label: "Undefined", emoji: "❓", sort_order: 99 },
];

Deno.test("pickFamilies: known slugs and salvaged labels, Undefined and junk dropped, at most five", () => {
  assertEquals(pickFamilies(["coffee", "Bar", "undefined", "nope", "coffee"], FAMILIES), ["coffee", "drinks"]);
  assertEquals(
    pickFamilies(["coffee", "breakfast", "dinner", "drinks", "fun", "spa"], FAMILIES),
    ["coffee", "breakfast", "dinner", "drinks", "fun"],
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
