import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isPermanentlyClosed, isQuickEnrich, quickPatch, stampOverwrite } from "./enrich.ts";

test("only an explicit quick job skips the paid enrichment", () => {
  assert.equal(isQuickEnrich({ placeId: "p", googlePlaceId: "g", depth: "quick" }), true);
  assert.equal(isQuickEnrich({ placeId: "p", googlePlaceId: "g", depth: "full" }), false);
  assert.equal(isQuickEnrich({ placeId: "p", googlePlaceId: "g" }), false);
});

test("quick writes Google's record and does not invent a description", () => {
  const patch = quickPatch({
    spine: { google_name: "Strana", address: "Blvd. Francisco" },
    description: null,
    googlePhotos: ["https://photos.example/a.jpg"],
    now: "2026-10-15T00:00:00.000Z",
  });
  assert.equal(patch.google_name, "Strana");
  assert.equal(patch.content_state, "ready");
  assert.equal(patch.enriched_at, "2026-10-15T00:00:00.000Z");
  assert.equal("description" in patch, false);
  assert.deepEqual(patch.google_photos, ["https://photos.example/a.jpg"]);
  assert.equal("photos" in patch, false);
});

test("Quick and Full stage Sync and do not call the review actor", () => {
  const src = readFileSync(new URL("./enrich.ts", import.meta.url), "utf8");
  const quick = src.indexOf("async function buildQuickEnrichment");
  const full = src.indexOf("export async function buildEnrichment");
  assert.ok(full > -1 && quick > full);
  assert.equal(src.slice(full, quick).includes("fetchDraftSync"), true);
  assert.equal(src.slice(quick).includes("fetchDraftSync"), true);
  assert.equal(src.includes("fetchApifyGoogleReviews"), false);
  assert.equal(src.includes('from "./reviews'), false);
});

test("the run records whether overwrite was on, without dropping the sync result", () => {
  const stamped = stampOverwrite({
    source_sync: { lastSyncedAt: "2026-10-16T00:00:00.000Z", sources: [] },
    instagram_followers_count: 12,
  }, false);
  const sync = stamped.source_sync as { overwrite: boolean; lastSyncedAt: string };
  assert.equal(sync.overwrite, false);
  assert.equal(sync.lastSyncedAt, "2026-10-16T00:00:00.000Z");
  assert.equal(stamped.instagram_followers_count, 12);
  const on = stampOverwrite({}, true).source_sync as { overwrite: boolean };
  assert.equal(on.overwrite, true);
});

test("quick keeps Google's own summary when it has one", () => {
  const patch = quickPatch({
    spine: { google_name: "Strana" },
    description: "A dining room.",
    googlePhotos: [],
    now: "2026-10-15T00:00:00.000Z",
  });
  assert.equal(patch.description, "A dining room.");
  assert.equal("google_photos" in patch, false);
  assert.equal("photos" in patch, false);
});

test("only Google's CLOSED_PERMANENTLY stops the run at Details", () => {
  assert.equal(isPermanentlyClosed({ businessStatus: "CLOSED_PERMANENTLY" }), true);
  assert.equal(isPermanentlyClosed({ businessStatus: " closed_permanently " }), true);
  assert.equal(isPermanentlyClosed({ businessStatus: "CLOSED_TEMPORARILY" }), false);
  assert.equal(isPermanentlyClosed({ businessStatus: "OPERATIONAL" }), false);
  assert.equal(isPermanentlyClosed({}), false);
});

test("the halt comes right after Place Details, before any paid step", () => {
  const src = readFileSync(new URL("./enrich.ts", import.meta.url), "utf8");
  const full = src.slice(src.indexOf("export async function buildEnrichment"));
  const halt = full.indexOf("if (isPermanentlyClosed(details)) return { closed: true };");
  assert.ok(halt > full.indexOf("await fetchGooglePlace("));
  for (const paid of ["fetchTimezone(", "scoutPlace(", "discoverLinks(", "fetchDraftSync(", "fetchInstagramPosts(", "rankGallery(", "embedPair("]) {
    assert.ok(full.indexOf(paid) > halt, `${paid} runs after the halt`);
  }
});

test("Strong runs the Scout before Links and hands its read to the Resolver", () => {
  const src = readFileSync(new URL("./enrich.ts", import.meta.url), "utf8");
  const full = src.slice(src.indexOf("export async function buildEnrichment"), src.indexOf("async function buildQuickEnrichment"));
  assert.ok(full.indexOf("scoutPlace(") < full.indexOf("discoverLinks("));
  assert.match(full, /context: scout\?\.summary \?\? null/);
  assert.equal(src.slice(src.indexOf("async function buildQuickEnrichment")).includes("scoutPlace("), false);
});
