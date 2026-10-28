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

Deno.test("every Enrich replaces the saved presentation; an empty one keeps it (MESITA-2799)", () => {
  const next = mergeSynthesizedProfile({
    patch: { content_state: "ready", description: "Already written." },
    presentation: "A new essay.",
    tags: null,
  });
  assertEquals(next.description, "A new essay.");
  const kept = mergeSynthesizedProfile({
    patch: { content_state: "ready", description: "Already written." },
    presentation: null,
    tags: null,
  });
  assertEquals(kept.description, "Already written.");
});

Deno.test("every Enrich writes the inferred tags and nothing of Google's (MESITA-2836)", () => {
  const next = mergeSynthesizedProfile({
    patch: { content_state: "ready" },
    presentation: null,
    tags: ["terraza"],
  });
  assertEquals(next.tags, ["terraza"]);
  for (const key of ["google_types", "category", "category_label", "family_keys"]) {
    assertEquals(key in next, false, key);
  }
});

Deno.test("a failed inference leaves tags out of the patch (MESITA-2827)", () => {
  // Failed = null. The patch carries none of the columns, so the stored
  // values stay; an empty tags answer is a real answer and is written.
  const failed = mergeSynthesizedProfile({
    patch: { content_state: "ready" },
    presentation: null,
    tags: null,
  });
  for (const key of ["google_types", "family_keys", "category", "category_label", "tags"]) {
    assertEquals(key in failed, false, key);
  }
  const noTags = mergeSynthesizedProfile({
    patch: { content_state: "ready" },
    presentation: null,
    tags: [],
  });
  assertEquals("category" in noTags, false);
  assertEquals(noTags.tags, []);
});

Deno.test("the anchor zone is Google's neighborhood, else the saved one; city the saved, else Google's", () => {
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
  // The stored Mesita Zone is the model's own reply (MESITA-2937): Google's
  // neighborhood outranks it so an inference never feeds itself.
  assertEquals(
    branchAnchor({
      zone: "Roma",
      google_address: {
        addressComponents: [{ types: ["neighborhood"], longText: "Roma Norte" }],
      },
    }).zone,
    "Roma Norte",
  );
  assertEquals(branchAnchor({}), { zone: null, city: null });
});
