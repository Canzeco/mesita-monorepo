import { assertEquals } from "jsr:@std/assert@1";
import { DISCOVERY_DEFAULTS } from "./discovery-config.ts";
import {
  admitMapCatalog,
  admitSwipeCatalog,
  enabledNearbyTypes,
  evaluatePlaceForMap,
  googleHitClearsMapFloors,
  listedClearsMapPopularity,
  listedMapFilters,
  mapShouldFillGoogle,
  primaryTypeClearsMapTypes,
} from "./map-engine.ts";
import type { NearbyHit } from "./nearby-places.ts";

const MAP = DISCOVERY_DEFAULTS.map;

function hit(over: Partial<NearbyHit> = {}): NearbyHit {
  return {
    placeId: "ChIJ1",
    name: "Cafe",
    address: "",
    lat: 25.67,
    lng: -100.3,
    rating: 4.2,
    primaryType: "cafe",
    ...over,
  };
}

Deno.test("defaults admit everything and fire every Nearby type", () => {
  assertEquals(enabledNearbyTypes(MAP), [
    "restaurant",
    "bar",
    "cafe",
    "night_club",
    "bakery",
  ]);
  assertEquals(mapShouldFillGoogle(true, MAP), true);
  assertEquals(mapShouldFillGoogle(false, MAP), false);
  assertEquals(googleHitClearsMapFloors(hit({ rating: null }), MAP), true);
  assertEquals(
    listedClearsMapPopularity({ google_stars_overall: null, google_review_count: null }, MAP),
    true,
  );
});

Deno.test("googleCount 0 skips Nearby even if googleFill is on", () => {
  assertEquals(mapShouldFillGoogle(true, { ...MAP, googleCount: 0 }), false);
});

Deno.test("googleFill off or all types off skips Nearby even if the client opts in", () => {
  assertEquals(mapShouldFillGoogle(true, { ...MAP, googleFill: false }), false);
  assertEquals(
    mapShouldFillGoogle(true, {
      ...MAP,
      types: {
        restaurant: false,
        bar: false,
        cafe: false,
        night_club: false,
        bakery: false,
      },
    }),
    false,
  );
  assertEquals(
    enabledNearbyTypes({
      ...MAP,
      types: { ...MAP.types, bakery: false, night_club: false },
    }),
    ["restaurant", "bar", "cafe"],
  );
});

Deno.test("listed Map filters take the stricter of global filters and Map floors", () => {
  const global = { ...DISCOVERY_DEFAULTS.filters, minRating: 3, minReviews: 10 };
  assertEquals(
    listedMapFilters(global, { ...MAP, minRating: 4, minReviews: 5 }),
    { ...global, minRating: 4, minReviews: 10 },
  );
});

Deno.test("unrated Google stubs drop when a rating or popularity floor is on", () => {
  const rated = { ...MAP, minRating: 3.5 };
  assertEquals(googleHitClearsMapFloors(hit({ rating: null }), rated), false);
  assertEquals(googleHitClearsMapFloors(hit({ rating: 3.4 }), rated), false);
  assertEquals(googleHitClearsMapFloors(hit({ rating: 3.5 }), rated), true);

  const pop = { ...MAP, minPopularity: 0.1 };
  assertEquals(googleHitClearsMapFloors(hit({ rating: null }), pop), false);
  assertEquals(googleHitClearsMapFloors(hit({ rating: 4.2 }), pop), true);
});

Deno.test("minPopularity uses popularity() — unrated listed miss a high floor", () => {
  // Default popularity() on an unrated row is the prior stretched to ~0.6.
  const high = { ...MAP, minPopularity: 0.7 };
  assertEquals(
    listedClearsMapPopularity({ google_stars_overall: null, google_review_count: 0 }, high),
    false,
  );
  assertEquals(
    listedClearsMapPopularity({ google_stars_overall: 4.8, google_review_count: 200 }, high),
    true,
  );
});

Deno.test("admitMapCatalog does not let Google stub a listed place that missed popularity", () => {
  const map = { ...MAP, minPopularity: 0.7 };
  const listed = [
    { id: "weak", google_place_id: "ChIJ-weak", google_stars_overall: null, google_review_count: 0 },
    { id: "strong", google_place_id: "ChIJ-strong", google_stars_overall: 4.8, google_review_count: 200 },
  ];
  const google = [
    hit({ placeId: "ChIJ-weak", rating: 4.9 }),
    hit({ placeId: "ChIJ-only", rating: 4.6 }),
  ];
  const got = admitMapCatalog(listed, google, map);
  assertEquals(got.listed.map((r) => r.id), ["strong"]);
  assertEquals(got.google.map((h) => h.placeId), ["ChIJ-only"]);
});

Deno.test("evaluatePlaceForMap admits restaurant subtypes when restaurant is on", () => {
  const ok = evaluatePlaceForMap(MAP, {
    primaryType: "mexican_restaurant",
    rating: 4.2,
    reviewCount: 80,
  });
  assertEquals(ok.eligible, true);
});

Deno.test("evaluatePlaceForMap admits wellness; rejects hotels", () => {
  const spa = evaluatePlaceForMap(MAP, {
    primaryType: "spa",
    rating: 4.8,
    reviewCount: 200,
  });
  assertEquals(spa.eligible, true);
  const hotel = evaluatePlaceForMap(MAP, {
    primaryType: "hotel",
    rating: 4.8,
    reviewCount: 200,
  });
  assertEquals(hotel.eligible, false);
});

Deno.test("evaluatePlaceForMap respects type batteries and floors", () => {
  const barsOnly = {
    ...MAP,
    types: {
      restaurant: false,
      bar: true,
      cafe: false,
      night_club: false,
      bakery: false,
    },
  };
  assertEquals(
    evaluatePlaceForMap(barsOnly, {
      primaryType: "night_club",
      rating: 4.5,
      reviewCount: 10,
    }).eligible,
    true,
  );
  assertEquals(
    evaluatePlaceForMap(barsOnly, {
      primaryType: "mexican_restaurant",
      rating: 4.5,
      reviewCount: 10,
    }).eligible,
    false,
  );
  const floored = { ...MAP, minRating: 4, minReviews: 50 };
  const low = evaluatePlaceForMap(floored, {
    primaryType: "restaurant",
    rating: 3.5,
    reviewCount: 200,
  });
  assertEquals(low.eligible, false);
  if (!low.eligible) assertEquals(low.code, "below_min_rating");
});

Deno.test("admitSwipeCatalog keeps listed F&B and spas, drops hotels, never Google", () => {
  const listed = [
    { id: "rest", category: "mexican_restaurant", listing_type: "web" as const },
    { id: "bar", category: "bar", listing_type: "partner" as const },
    { id: "hotel", category: "hotel", listing_type: "web" as const },
    { id: "spa", category: "spa", listing_type: "partner" as const },
    { id: "unk", category: "undefined", listing_type: "web" as const },
  ];
  const got = admitSwipeCatalog(listed, MAP);
  assertEquals(got.map((r) => r.id), ["rest", "bar", "spa", "unk"]);
});

Deno.test("admitSwipeCatalog honors Map type batteries", () => {
  const barsOnly = {
    ...MAP,
    types: {
      restaurant: false,
      bar: true,
      cafe: false,
      night_club: false,
      bakery: false,
    },
  };
  const listed = [
    { id: "rest", category: "restaurant" },
    { id: "club", category: "night_club" },
  ];
  assertEquals(admitSwipeCatalog(listed, barsOnly).map((r) => r.id), ["club"]);
});

Deno.test("Atlas leftover slugs admit via Super membership, not Google type", () => {
  assertEquals(primaryTypeClearsMapTypes("undefined", MAP), true);
  assertEquals(primaryTypeClearsMapTypes("board_game_cafe", MAP), true);
  assertEquals(primaryTypeClearsMapTypes("hotel", MAP), false);
  assertEquals(primaryTypeClearsMapTypes("gas_station", MAP), false);
});
