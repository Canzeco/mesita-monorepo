// Write guards: Google's own types are stored primary-first without Table B
// (MESITA-2790); the taxonomy trigger derives the Google categories from them
// (MESITA-2836) and the profiles view the families (MESITA-2834), so nothing
// in code writes google_types or family_keys.

import { assertEquals } from "jsr:@std/assert@1";
import { cleanGoogleTypes, googleTypesPrimaryFirst } from "./google-table-b.ts";
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


Deno.test("Mesita tags: vocabulary only; a missing tags key is a failure, [] is an answer", () => {
  const vocab = new Set(["terraza", "dj"]);
  assertEquals(pickVocabularyTags(["DJ", "made_up", "terraza", "dj"], vocab), ["dj", "terraza"]);
  assertEquals(pickVocabularyTags([], vocab), []);
  assertEquals(pickVocabularyTags(undefined, vocab), null);
});

