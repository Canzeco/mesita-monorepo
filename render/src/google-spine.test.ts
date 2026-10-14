import assert from "node:assert/strict";
import test from "node:test";
import { photoUris, profileFromGoogle } from "./google-spine.ts";

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
  priceLevel: "PRICE_LEVEL_EXPENSIVE",
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
  assert.equal(got.patch.website_url, "https://example.com/");
  assert.equal(got.patch.price_level, 3);
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

test("photo links are https only, ten at most", () => {
  const bodies = [
    { photoUri: "https://lh3.googleusercontent.com/a" },
    { photoUri: "http://insecure.example/a" },
    { photoUri: "" },
    ...Array.from({ length: 12 }, (_, i) => ({ photoUri: `https://lh3.googleusercontent.com/${i}` })),
  ];
  const urls = photoUris(bodies);
  assert.equal(urls.length, 10);
  assert.equal(urls[0], "https://lh3.googleusercontent.com/a");
});

test("Google's Instagram link is the Instagram field, not the website", () => {
  const got = profileFromGoogle({
    ...PLACE,
    websiteUri: "https://www.instagram.com/casaluminar/",
    priceLevel: "PRICE_LEVEL_UNSPECIFIED",
    reviews: [{ rating: Number.NaN, text: { text: "Bien" } }],
  }, "ChIJ-test");
  assert.equal(got.ok, true);
  if (!got.ok) return;
  assert.equal(got.patch.instagram_url, "https://www.instagram.com/casaluminar");
  assert.equal(got.patch.instagram_found, true);
  assert.equal("website_url" in got.patch, false);
  assert.equal("price_level" in got.patch, false);
  assert.equal((got.patch.google_reviews as { rating: number }[])[0].rating, 0);
});

test("a place without a name, coordinates, or address writes nothing", () => {
  assert.equal(profileFromGoogle({ ...PLACE, displayName: { text: "" } }, "x").ok, false);
  assert.equal(profileFromGoogle({ ...PLACE, location: {} }, "x").ok, false);
  assert.equal(profileFromGoogle({ ...PLACE, formattedAddress: "  " }, "x").ok, false);
});
