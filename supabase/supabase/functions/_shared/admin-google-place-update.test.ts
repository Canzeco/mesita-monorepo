import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  assertGoogleUpdatePatchSafe,
  googleBasicsToUpdatePatch,
  GOOGLE_UPDATE_FORBIDDEN_COLUMNS,
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

Deno.test("googleBasicsToUpdatePatch writes google_photos, never photos or mesita_photos", () => {
  const patch = googleBasicsToUpdatePatch({
    basics: sampleBasics(),
    businessStatus: "OPERATIONAL",
    googlePhotos: ["https://cdn.example/1.jpg"],
    googlePrimaryType: "restaurant",
    googleTypes: ["restaurant", "food"],
    now: NOW,
  });
  assertEquals(patch.google_photos, ["https://cdn.example/1.jpg"]);
  assertEquals(patch.google_tags, ["dine_in", "live_music"]);
  assertEquals("photos" in patch, false);
  assertEquals("mesita_photos" in patch, false);
  assertEquals(patch.business_state, "OPERATIONAL");
});

Deno.test("assertGoogleUpdatePatchSafe rejects mesita catalog keys", () => {
  assertThrows(
    () => assertGoogleUpdatePatchSafe({ mesita_photos: ["x"] }),
    Error,
    "mesita_photos",
  );
});

Deno.test("forbidden column list includes mesita catalog keys", () => {
  assertEquals(GOOGLE_UPDATE_FORBIDDEN_COLUMNS.includes("mesita_photos"), true);
  assertEquals(GOOGLE_UPDATE_FORBIDDEN_COLUMNS.includes("photos"), true);
});
