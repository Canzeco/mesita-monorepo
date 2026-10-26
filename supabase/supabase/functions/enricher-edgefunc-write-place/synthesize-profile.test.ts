import { assertEquals } from "jsr:@std/assert@1";
import { branchAnchor, capPresentation, mergeSynthesizedProfile, reviewQuotes } from "./synthesize-profile.ts";

Deno.test("a presentation longer than the ceiling is cut at a sentence, never mid-word (MESITA-2641)", () => {
  // No break at all: cut inside the ceiling and close with an ellipsis.
  const text = "a".repeat(2500);
  assertEquals(capPresentation(text).length, 2000);
  assertEquals(capPresentation(text).endsWith("…"), true);
  assertEquals(capPresentation("  nightclub  "), "nightclub");
  // The live case: a char slice landed on "with family o"; sentence-safe cap fixes it.
  const long = `${"A fine taco place. ".repeat(130)}Ideal for meals with family or friends.`;
  const cut = capPresentation(long);
  assertEquals(cut.length <= 2000, true);
  assertEquals(cut.endsWith("A fine taco place."), true);
});

Deno.test("review quotes are the text the presentation can read", () => {
  assertEquals(reviewQuotes([
    { quote: " Loud room " },
    { quote: "" },
    { author: "Ana" },
    { quote: "Bottle service" },
  ]), "Loud room\nBottle service");
});

Deno.test("overwrite off keeps a saved presentation", () => {
  const next = mergeSynthesizedProfile({
    overwrite: false,
    patch: { content_state: "ready", description: "Already written." },
    presentation: "A new essay that should not replace the saved one.",
    categories: null,
    tags: null,
  });
  assertEquals(next.description, "Already written.");
});

Deno.test("every Enrich writes the inferred Mesita categories and tags, whatever Overwrite says (MESITA-2790)", () => {
  for (const overwrite of [false, true]) {
    const next = mergeSynthesizedProfile({
      overwrite,
      patch: { content_state: "ready" },
      presentation: null,
      categories: ["bakery", "cafe"],
      tags: ["terraza"],
    });
    assertEquals(next.mesita_categories, ["bakery", "cafe"]);
    assertEquals(next.category, "bakery");
    assertEquals(next.category_label, "Bakery");
    assertEquals(next.tags, ["terraza"]);
  }
});

Deno.test("a failed inference leaves Mesita categories and tags out of the patch (MESITA-2790)", () => {
  // Failed = null. The patch carries none of the four columns, so the stored
  // values stay; an empty tags answer is a real answer and is written.
  const failed = mergeSynthesizedProfile({
    overwrite: true,
    patch: { content_state: "ready" },
    presentation: null,
    categories: null,
    tags: null,
  });
  for (const key of ["mesita_categories", "category", "category_label", "tags"]) {
    assertEquals(key in failed, false, key);
  }
  const noTags = mergeSynthesizedProfile({
    overwrite: false,
    patch: { content_state: "ready" },
    presentation: null,
    categories: [],
    tags: [],
  });
  assertEquals("category" in noTags, false);
  assertEquals(noTags.tags, []);
});

Deno.test("the franchise anchor is the saved zone and city, else Google's structured address", () => {
  assertEquals(branchAnchor({ zone: "Polanco", city: "Ciudad de México" }), {
    zone: "Polanco",
    city: "Ciudad de México",
  });
  assertEquals(
    branchAnchor({
      google_address: {
        addressComponents: [
          { types: ["sublocality_level_1", "sublocality"], longText: "Roma Nte." },
          { types: ["locality", "political"], longText: "Ciudad de México" },
        ],
      },
    }),
    { zone: "Roma Nte.", city: "Ciudad de México" },
  );
  assertEquals(branchAnchor({}), { zone: null, city: null });
});
