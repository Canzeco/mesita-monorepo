import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { commitPatch, isPermanentlyClosed } from "./enrich.ts";

test("an empty or failed step never blanks a filled field; a fresh value replaces it", () => {
  const patch = commitPatch({
    instagram_url: null,
    facebook_url: "",
    photos: [],
    website_url: "https://new.example",
    description: "fresh",
    content_state: "ready",
  });
  // Absent keys leave the saved columns alone at the write.
  assert.equal("instagram_url" in patch, false);
  assert.equal("facebook_url" in patch, false);
  assert.equal("photos" in patch, false);
  assert.equal(patch.website_url, "https://new.example");
  assert.equal(patch.description, "fresh");
});

test("Render never sends the Mesita-owned columns (MESITA-2790)", () => {
  const patch = commitPatch({ category: "cafe", category_label: "Cafe", mesita_categories: ["cafe"], tags: ["x"], google_name: "Strana" });
  for (const key of ["category", "category_label", "mesita_categories", "tags"]) assert.equal(key in patch, false, key);
  assert.equal(patch.google_name, "Strana");
});

test("Enrich stages Sync and does not call the review actor", () => {
  const src = readFileSync(new URL("./enrich.ts", import.meta.url), "utf8");
  assert.equal(src.includes("fetchDraftSync"), true);
  assert.equal(src.includes("fetchApifyGoogleReviews"), false);
  assert.equal(src.includes('from "./reviews'), false);
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

test("Enrich runs the Scout before Links and hands its read to the Resolver", () => {
  const src = readFileSync(new URL("./enrich.ts", import.meta.url), "utf8");
  const full = src.slice(src.indexOf("export async function buildEnrichment"), src.indexOf("function imageKnobs("));
  assert.ok(full.indexOf("scoutPlace(") < full.indexOf("discoverLinks("));
  assert.match(full, /context: scout\?\.summary \?\? null/);
});
