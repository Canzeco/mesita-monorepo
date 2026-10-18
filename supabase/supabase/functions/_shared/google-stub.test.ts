// A Google-only card carries everything the Nearby mask returns (MESITA-2313).
import { assert, assertEquals } from "jsr:@std/assert@1";
import { googleStub, humanizeGoogleType } from "./google-stub.ts";
import { NEARBY_FIELD_MASK, type NearbyHit } from "./nearby-places.ts";

const HIT: NearbyHit = {
  placeId: "ChIJ-bar",
  name: "La Cantina",
  address: "Av. Siempre Viva 742, Roma Nte., 06700 Ciudad de México, CDMX, Mexico",
  lat: 19.41,
  lng: -99.16,
  rating: 4.6,
  primaryType: "sports_bar",
  businessStatus: "OPERATIONAL",
  reviewCount: 812,
  openNow: true,
  typeLabel: "Sports bar",
  priceLevel: "PRICE_LEVEL_MODERATE",
  shortAddress: "Av. Siempre Viva 742, Roma Nte.",
  mapsUri: "https://maps.google.com/?cid=1",
  phone: "+52 55 1234 5678",
  website: "https://cantina.example",
};

Deno.test("stub: readable type, price, stars, reviews, open now, short address, links", () => {
  const card = googleStub(HIT, 1.2);
  assertEquals(card.category_label, "Sports bar");
  assertEquals(card.category, "sports_bar");
  assertEquals(card.price_level, 2);
  assertEquals(card.google_stars_overall, 4.6);
  assertEquals(card.google_review_count, 812);
  assertEquals(card.open_now, true);
  assertEquals(card.address, "Av. Siempre Viva 742, Roma Nte.");
  assertEquals(card.google_maps_url, "https://maps.google.com/?cid=1");
  assertEquals(card.phone, "+52 55 1234 5678");
  assertEquals(card.website_url, "https://cantina.example");
  assertEquals(card.photos, []);
  assertEquals(card.googleOnly, true);
  assertEquals(card.distance_km, 1.2);
});

Deno.test("stub: no label falls back to the humanized slug; no price is null", () => {
  const card = googleStub(
    { ...HIT, typeLabel: null, priceLevel: null, shortAddress: null },
    null,
  );
  assertEquals(card.category_label, "Sports bar");
  assertEquals(card.price_level, null);
  assertEquals(card.address, HIT.address);
  assertEquals(humanizeGoogleType("cafe"), "Cafe");
  assertEquals(humanizeGoogleType(null), null);
});

Deno.test("mask: asks for every card field, never a photo or an Atmosphere field", () => {
  for (const field of [
    "places.primaryTypeDisplayName",
    "places.priceLevel",
    "places.shortFormattedAddress",
    "places.currentOpeningHours.openNow",
    "places.googleMapsUri",
    "places.internationalPhoneNumber",
    "places.websiteUri",
    "places.rating",
    "places.userRatingCount",
  ]) {
    assert(NEARBY_FIELD_MASK.split(",").includes(field), field);
  }
  for (const dear of ["photos", "reviews", "editorialSummary", "generativeSummary"]) {
    assertEquals(NEARBY_FIELD_MASK.includes(dear), false, dear);
  }
});
