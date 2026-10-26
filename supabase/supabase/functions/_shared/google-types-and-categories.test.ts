// MESITA-2790 write guards: google_types is stored primary-first without
// Table B, and only known Mesita category slugs (1–3, never `undefined`)
// reach place_profiles.

import { assertEquals } from "jsr:@std/assert@1";
import { cleanGoogleTypes, googleTypesPrimaryFirst } from "./google-table-b.ts";
import { MESITA_CATEGORIES_MAX, parseCategoriesReply } from "./categories-infer.ts";
import type { PlaceCategory } from "./categories.ts";
import { pickVocabularyTags } from "./tags.ts";

Deno.test("Google's primary leads google_types, deduped, Table B dropped", () => {
  assertEquals(
    googleTypesPrimaryFirst("night_club", ["bar", "night_club", "point_of_interest", "bar"]),
    ["night_club", "bar"],
  );
});

Deno.test("a Table B primary never leads: the first real type does", () => {
  assertEquals(
    googleTypesPrimaryFirst("establishment", ["point_of_interest", "cafe", "bakery"]),
    ["cafe", "bakery"],
  );
  assertEquals(googleTypesPrimaryFirst(null, ["cafe"]), ["cafe"]);
  assertEquals(cleanGoogleTypes(null), []);
});

const categories: PlaceCategory[] = [
  { slug: "bakery", label: "🥐 Bakery", section: "Sweet", sort_order: 1, family_keys: ["sweet"] },
  { slug: "cafe", label: "☕ Cafe", section: "Coffee", sort_order: 2, family_keys: ["coffee"] },
  { slug: "taqueria", label: "🌮 Taquería", section: "Mexican", sort_order: 3, family_keys: ["mexican"] },
  { slug: "bar", label: "🍸 Bar", section: "Drinks", sort_order: 4, family_keys: ["drinks"] },
  { slug: "undefined", label: "Undefined", section: "Other", sort_order: 99, family_keys: ["undefined"] },
];

Deno.test("only known slugs survive, main first, at most three", () => {
  assertEquals(
    parseCategoriesReply('{"categories":["bakery","nope","cafe","bakery","taqueria","bar"]}', categories),
    ["bakery", "cafe", "taqueria"],
  );
  assertEquals(MESITA_CATEGORIES_MAX, 3);
});

Deno.test("undefined is never a Mesita category; labels are salvaged to slugs", () => {
  assertEquals(parseCategoriesReply('{"categories":["undefined"]}', categories), null);
  assertEquals(parseCategoriesReply('{"categories":["🥐 Bakery","undefined"]}', categories), ["bakery"]);
});

Deno.test("a malformed or empty reply is a failure, not an empty write", () => {
  assertEquals(parseCategoriesReply("not json", categories), null);
  assertEquals(parseCategoriesReply('{"categories":[]}', categories), null);
  assertEquals(parseCategoriesReply("{}", categories), null);
});

Deno.test("Mesita tags: vocabulary only; a missing tags key is a failure, [] is an answer", () => {
  const vocab = new Set(["terraza", "dj"]);
  assertEquals(pickVocabularyTags(["DJ", "made_up", "terraza", "dj"], vocab), ["dj", "terraza"]);
  assertEquals(pickVocabularyTags([], vocab), []);
  assertEquals(pickVocabularyTags(undefined, vocab), null);
});
