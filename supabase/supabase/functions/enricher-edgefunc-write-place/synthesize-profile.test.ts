import { assertEquals } from "jsr:@std/assert@1";
import { capPresentation, mergeSynthesizedProfile, reviewQuotes } from "./synthesize-profile.ts";

Deno.test("a presentation longer than 500 characters is cut there", () => {
  const text = "a".repeat(800);
  assertEquals(capPresentation(text).length, 500);
  assertEquals(capPresentation("  nightclub  "), "nightclub");
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
    saved: { description: "Already written.", category: "nightclub", tags: ["dj"] },
    patch: { content_state: "ready", description: "Google blurb" },
    presentation: "A new essay that should not replace the saved one.",
    category: "bar",
    tags: ["bottle_service", "dj"],
  });
  assertEquals(next.description, "Already written.");
  assertEquals(next.category, undefined);
  assertEquals(next.tags, ["dj", "bottle_service"]);
});

Deno.test("an empty profile takes the presentation, one category, and the tags", () => {
  const long = "b".repeat(900);
  const next = mergeSynthesizedProfile({
    overwrite: false,
    saved: {},
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
    saved: { description: "Old", category: "bar", tags: ["quiet"] },
    patch: { content_state: "ready", source_sync: { overwrite: true } },
    presentation: "Vibrant nightclub.",
    category: "nightclub",
    tags: ["dj"],
  });
  assertEquals(next.description, "Vibrant nightclub.");
  assertEquals(next.category, "nightclub");
  assertEquals(next.tags, ["dj"]);
});
