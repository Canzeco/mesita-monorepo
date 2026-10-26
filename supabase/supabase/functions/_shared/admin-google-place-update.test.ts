import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  assertGoogleUpdatePatchSafe,
  googleBasicsToUpdatePatch,
  galleryTakesGoogleHero,
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

Deno.test("googleBasicsToUpdatePatch never carries the gallery", () => {
  const patch = googleBasicsToUpdatePatch({
    basics: sampleBasics(),
    businessStatus: "OPERATIONAL",
    googlePrimaryType: "restaurant",
    googleTypes: ["restaurant", "food"],
    hasMesitaCategories: false,
    now: NOW,
  });
  assertEquals("photos" in patch, false);
  assertEquals("google_photos" in patch, false);
  assertEquals(patch.business_state, "OPERATIONAL");
});

Deno.test("a refetch never overwrites a filled Mesita category (MESITA-2790)", () => {
  const input = {
    basics: sampleBasics(),
    businessStatus: null,
    googlePrimaryType: "restaurant",
    googleTypes: ["food", "restaurant"],
    now: NOW,
  };
  const mesita = googleBasicsToUpdatePatch({ ...input, hasMesitaCategories: true });
  assertEquals("category" in mesita, false);
  assertEquals("category_label" in mesita, false);
  assertEquals(mesita.google_types, ["restaurant"]);
  const google = googleBasicsToUpdatePatch({ ...input, hasMesitaCategories: false });
  assertEquals(google.category, "restaurant");
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
