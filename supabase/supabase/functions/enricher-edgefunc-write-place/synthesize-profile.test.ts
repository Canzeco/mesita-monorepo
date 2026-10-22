import { assertEquals } from "jsr:@std/assert@1";
import { branchAnchor, capPresentation, mergeSynthesizedProfile, reviewQuotes } from "./synthesize-profile.ts";

Deno.test("a presentation longer than 500 characters is cut at a sentence, never mid-word (MESITA-2641)", () => {
  // No break at all: cut inside the ceiling and close with an ellipsis.
  const text = "a".repeat(800);
  assertEquals(capPresentation(text).length, 500);
  assertEquals(capPresentation(text).endsWith("…"), true);
  assertEquals(capPresentation("  nightclub  "), "nightclub");
  // The live case: a 500-character slice landed on "with family o".
  const long = `${"A fine taco place. ".repeat(26)}Ideal for meals with family or friends.`;
  const cut = capPresentation(long);
  assertEquals(cut.length <= 500, true);
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

Deno.test("overwrite off keeps a saved presentation and adds tags", () => {
  const next = mergeSynthesizedProfile({
    overwrite: false,
    patch: {
      content_state: "ready",
      description: "Already written.",
      category: "nightclub",
      tags: ["dj"],
    },
    presentation: "A new essay that should not replace the saved one.",
    category: "bar",
    tags: ["bottle_service", "dj"],
  });
  assertEquals(next.description, "Already written.");
  assertEquals(next.category, "nightclub");
  assertEquals(next.tags, ["dj", "bottle_service"]);
});

Deno.test("an empty profile takes the presentation, one category, and the tags", () => {
  const long = "b".repeat(900);
  const next = mergeSynthesizedProfile({
    overwrite: false,
    patch: { content_state: "ready" },
    presentation: long,
    category: "nightclub",
    tags: ["dj", "bottle_service"],
  });
  assertEquals(typeof next.description === "string" && next.description.length, 500);
  assertEquals(next.category, "nightclub");
  assertEquals(next.category_label, "Nightclub");
  assertEquals(next.tags, ["dj", "bottle_service"]);
});

Deno.test("overwrite on replaces the presentation, the category, and the tags", () => {
  const next = mergeSynthesizedProfile({
    overwrite: true,
    patch: {
      content_state: "ready",
      description: "Old",
      category: "bar",
      tags: ["quiet"],
      source_sync: { overwrite: true },
    },
    presentation: "Vibrant nightclub.",
    category: "nightclub",
    tags: ["dj"],
  });
  assertEquals(next.description, "Vibrant nightclub.");
  assertEquals(next.category, "nightclub");
  assertEquals(next.tags, ["dj"]);
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
