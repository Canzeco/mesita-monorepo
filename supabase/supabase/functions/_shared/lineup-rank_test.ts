import { assertEquals, assertExists } from "jsr:@std/assert@1";
import { lineupReorder } from "./lineup-rank.ts";
import { DEFAULT_SCORING_SETTINGS } from "./lineup-scoring.ts";

Deno.test("lineupReorder attaches winning-lane score + lane on each place", () => {
  const places = [
    {
      id: "A",
      lat: 25.68,
      lng: -100.32,
      listing_type: "partner" as const,
      hours: null,
      embedding: null,
      google_review_count: 200,
      google_stars_overall: 4.5,
      manual_priority: 0.5,
    },
    {
      id: "B",
      lat: 25.69,
      lng: -100.31,
      listing_type: "web" as const,
      hours: null,
      embedding: null,
      google_review_count: 20,
      google_stars_overall: 4.0,
      manual_priority: 0.1,
    },
  ];
  const cosine = new Map<string, number>([
    ["A", 0.9],
    ["B", 0.6],
  ]);

  const ordered = lineupReorder(places, cosine, DEFAULT_SCORING_SETTINGS, {
    lat: 25.68,
    lng: -100.32,
    xxSeed: "test:score-attach",
  });

  assertEquals(ordered.length > 0, true);
  for (const row of ordered) {
    assertExists(row.score);
    assertEquals(typeof row.score, "number");
    assertEquals(Number.isFinite(row.score), true);
    assertEquals(row.score > 0, true);
    assertEquals(row.lane === "organic" || row.lane === "inorganic", true);
    // Swipe card display precision — playground parity.
    assertEquals(row.score.toFixed(3).length >= 3, true);
  }

  // Partner A should outrank web B under default settings with stronger EM.
  assertEquals(ordered[0].id, "A");
  assertEquals(ordered[0].score >= ordered[ordered.length - 1].score, true);
});
