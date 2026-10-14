import assert from "node:assert/strict";
import test from "node:test";
import { profileFromGoogle } from "./google-spine.ts";

const PLACE = {
  id: "ChIJ-test",
  displayName: { text: "Casa Luminar" },
  formattedAddress: "Av. Ámsterdam 1, CDMX",
  location: { latitude: 19.4, longitude: -99.1 },
  internationalPhoneNumber: "+52 55 0000 0000",
  editorialSummary: { text: "Cocina de mercado en la Condesa." },
  addressComponents: [{ types: ["locality"], longText: "Ciudad de México" }],
  rating: 4.6,
  userRatingCount: 120,
  businessStatus: "OPERATIONAL",
  websiteUri: "https://example.com",
  regularOpeningHours: {
    weekdayDescriptions: ["Monday: 9:00 AM – 6:00 PM"],
    periods: [{ open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 18, minute: 0 } }],
  },
  reviews: [{
    authorAttribution: { displayName: "Ana" },
    rating: 5,
    text: { text: "Muy bueno" },
    relativePublishTimeDescription: "hace una semana",
  }],
};

test("a complete Google place becomes a finished profile without a database key", () => {
  const got = profileFromGoogle(PLACE, "ChIJ-test");
  assert.equal(got.ok, true);
  if (!got.ok) return;
  assert.equal(got.description, "Cocina de mercado en la Condesa.");
  assert.equal(got.patch.google_name, "Casa Luminar");
  assert.equal(got.patch.phone, "+52 55 0000 0000");
  assert.equal(got.patch.city, "Ciudad de México");
  assert.equal(got.patch.google_found, true);
  assert.deepEqual(got.patch.hours, { monday: [{ open: "09:00", close: "18:00" }] });
  assert.equal(got.patch.closes_at, "18:00");
  assert.deepEqual(got.patch.google_reviews, [{
    author: "Ana",
    rating: 5,
    quote: "Muy bueno",
    date: "hace una semana",
  }]);
  assert.equal(got.patch.pitch, "Cocina de mercado en la Condesa.");
  assert.equal("google_place_id" in got.patch, false);
  assert.equal("content_state" in got.patch, false);
});

test("a place without a name, coordinates, or address writes nothing", () => {
  assert.equal(profileFromGoogle({ ...PLACE, displayName: { text: "" } }, "x").ok, false);
  assert.equal(profileFromGoogle({ ...PLACE, location: {} }, "x").ok, false);
  assert.equal(profileFromGoogle({ ...PLACE, formattedAddress: "  " }, "x").ok, false);
});
