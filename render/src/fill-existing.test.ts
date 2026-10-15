import assert from "node:assert/strict";
import test from "node:test";
import { applyOverwrite } from "./fill-existing.ts";

test("off keeps a saved link and still takes the new review count", () => {
  const next = applyOverwrite({
    overwrite: false,
    saved: { instagram_url: "https://instagram.com/old", description: "kept", tags: ["terraza"] },
    patch: {
      instagram_url: "https://instagram.com/new",
      description: "rewritten",
      google_review_count: 12,
      tags: ["desayuno"],
      address: "Av. Nueva 1",
    },
  });
  assert.equal(next.instagram_url, "https://instagram.com/old");
  assert.equal(next.description, "kept");
  assert.equal(next.google_review_count, 12);
  assert.equal(next.address, "Av. Nueva 1");
  assert.deepEqual(next.tags, ["terraza", "desayuno"]);
});

test("off fills a field that was empty", () => {
  const next = applyOverwrite({
    overwrite: false,
    saved: { description: "  ", phone: null },
    patch: { description: "from google", phone: "+52 81 0000 0000" },
  });
  assert.equal(next.description, "from google");
  assert.equal(next.phone, "+52 81 0000 0000");
});

test("on replaces links and the tag set", () => {
  const next = applyOverwrite({
    overwrite: true,
    saved: { instagram_url: "https://instagram.com/old", tags: ["terraza"] },
    patch: { instagram_url: "https://instagram.com/new", tags: ["desayuno"] },
  });
  assert.equal(next.instagram_url, "https://instagram.com/new");
  assert.deepEqual(next.tags, ["desayuno"]);
});
