import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  assertGoogleUpdatePatchSafe,
  googleDetailsPatch,
  galleryTakesGoogleHero,
  googleWriteRule,
} from "./admin-google-place-update.ts";
import type { GoogleBasics } from "./enrich-google-basics.ts";

const NOW = "2026-10-23T12:00:00.000Z";

function sampleBasics(): GoogleBasics {
  return {
    google_place_id: "ChIJtest",
    google_name: "Test Place",
    category: "restaurant",
    category_label: "Restaurant",
    price_level: 2,
    lat: 19.4,
    lng: -99.1,
    address: "Calle 1",
    zone: "Roma",
    city: "CDMX",
    timezone: "America/Mexico_City",
    closes_at: "22:00",
    hours: null,
    phone: "+525512345678",
    pitch: "Google pitch",
    story: "Google story",
    photos: ["https://example.com/a.jpg"],
    website_url: "https://example.com",
    instagram_url: null,
    facebook_url: null,
    x_url: null,
    threads_url: null,
    reddit_url: null,
    whatsapp_url: null,
    opentable_url: null,
    resy_url: null,
    uber_eats_url: null,
    didi_food_url: null,
    google_maps_url: "https://maps.google.com",
    google_stars_overall: 4.5,
    google_review_count: 10,
    google_reviews: [],
    google_tags: ["dine_in", "live_music"],
  };
}

Deno.test("googleDetailsPatch never carries the gallery", () => {
  const patch = googleDetailsPatch({
    basics: sampleBasics(),
    businessStatus: "OPERATIONAL",
    googlePrimaryType: "restaurant",
    googleTypes: ["restaurant", "food"],
    now: NOW,
  });
  assertEquals("photos" in patch, false);
  assertEquals("google_photos" in patch, false);
  assertEquals(patch.business_state, "OPERATIONAL");
});

Deno.test("a refetch never overwrites the inferred categories or families (MESITA-2827)", () => {
  const patch = googleDetailsPatch({
    basics: sampleBasics(),
    businessStatus: null,
    googlePrimaryType: "restaurant",
    googleTypes: ["food", "restaurant"],
    now: NOW,
  });
  for (const key of ["google_types", "category", "category_label", "family_keys"]) {
    assertEquals(key in patch, false, key);
  }
  assertEquals(patch.google_source_types, ["restaurant"]);
  assertThrows(() => assertGoogleUpdatePatchSafe({ google_types: ["bar"] }), Error, "google_types");
});

Deno.test("assertGoogleUpdatePatchSafe rejects the gallery", () => {
  assertThrows(() => assertGoogleUpdatePatchSafe({ photos: ["x"] }), Error, "photos");
});

Deno.test("Update takes Google's hero only while the gallery is at most one photo", () => {
  assertEquals(galleryTakesGoogleHero([]), true);
  assertEquals(galleryTakesGoogleHero(null), true);
  assertEquals(galleryTakesGoogleHero(["https://a.example/1.jpg"]), true);
  assertEquals(galleryTakesGoogleHero(["https://a.example/1.jpg", " "]), true);
  // An enriched gallery is never overwritten.
  assertEquals(galleryTakesGoogleHero(["https://a.example/1.jpg", "https://a.example/2.jpg"]), false);
});

Deno.test("the Details patch leaves the review list to the Reviews step (MESITA-3844)", () => {
  const patch = googleDetailsPatch({
    basics: { ...sampleBasics(), google_reviews: [{ author: "a", rating: 5, quote: "q", date: "d" }] },
    businessStatus: null,
    googlePrimaryType: null,
    googleTypes: [],
    now: NOW,
  });
  assertEquals("google_reviews" in patch, false);
  assertEquals(patch.google_found, true);
});

Deno.test("Update's write rule: a pin is kept and an empty never blanks a filled field (MESITA-3844)", () => {
  const sources = { pins: { phone: { source: "business", confidence: 1, pinnedUntil: "2027-01-01T00:00:00.000Z" } } };
  const { patch, pinned } = googleWriteRule(
    { phone: "+52 55 0000 0000", instagram_url: null, website_url: "", hours: [], google_name: "Test" },
    sources,
    new Date(NOW),
  );
  assertEquals(patch, { google_name: "Test" });
  assertEquals(pinned, ["phone"]);
});
