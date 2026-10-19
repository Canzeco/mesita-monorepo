import assert from "node:assert/strict";
import test from "node:test";
import { commitBody, stopEnrichingBody, writePlaceUrl } from "./write-place.ts";

test("the write URL is the one enrichment function", () => {
  assert.equal(
    writePlaceUrl("https://yjalywfzdelacdzccpgb.supabase.co/"),
    "https://yjalywfzdelacdzccpgb.supabase.co/functions/v1/enricher-edgefunc-write-place",
  );
});

test("a failed run asks the same function to turn enriching off", () => {
  assert.deepEqual(stopEnrichingBody("place-1"), { placeId: "place-1", stop: true });
});

test("the liveness halt is a stop that says the place is closed", () => {
  assert.deepEqual(stopEnrichingBody("place-1", { closed: true }), { placeId: "place-1", stop: true, closed: true });
});

test("the commit carries the steps and the Scout's read beside the profile, and nothing empty", () => {
  const built = {
    patch: { content_state: "ready", google_name: "Pujol" },
    mirrorPhotos: true,
    photoAnalyses: [],
    steps: { serp: { state: "completed" as const, detail: "The Scout wrote 40 words of web context." } },
    serpSummary: "A tasting menu.",
  };
  assert.deepEqual(commitBody("place-1", built, "2026-10-19T00:00:00Z"), {
    placeId: "place-1",
    patch: built.patch,
    mirrorPhotos: true,
    baseUpdatedAt: "2026-10-19T00:00:00Z",
    steps: built.steps,
    serpSummary: "A tasting menu.",
  });
  assert.deepEqual(commitBody("place-1", { ...built, steps: {}, serpSummary: null }), {
    placeId: "place-1",
    patch: built.patch,
    mirrorPhotos: true,
  });
});
