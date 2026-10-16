import assert from "node:assert/strict";
import test from "node:test";
import { isQuickEnrich, quickPatch } from "./enrich.ts";

test("only an explicit quick job skips the paid enrichment", () => {
  assert.equal(isQuickEnrich({ placeId: "p", googlePlaceId: "g", depth: "quick" }), true);
  assert.equal(isQuickEnrich({ placeId: "p", googlePlaceId: "g", depth: "full" }), false);
  assert.equal(isQuickEnrich({ placeId: "p", googlePlaceId: "g" }), false);
});

test("quick writes Google's record and does not invent a description", () => {
  const patch = quickPatch({
    spine: { google_name: "Strana", address: "Blvd. Francisco" },
    description: null,
    photos: ["https://photos.example/a.jpg"],
    now: "2026-10-15T00:00:00.000Z",
  });
  assert.equal(patch.google_name, "Strana");
  assert.equal(patch.content_state, "ready");
  assert.equal(patch.enriched_at, "2026-10-15T00:00:00.000Z");
  assert.equal("description" in patch, false);
  assert.deepEqual(patch.photos, ["https://photos.example/a.jpg"]);
});

test("quick keeps Google's own summary when it has one", () => {
  const patch = quickPatch({
    spine: { google_name: "Strana" },
    description: "A dining room.",
    photos: [],
    now: "2026-10-15T00:00:00.000Z",
  });
  assert.equal(patch.description, "A dining room.");
  assert.equal("photos" in patch, false);
});
