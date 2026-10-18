import { assertEquals } from "jsr:@std/assert@1";
import { DISCOVERY_DEFAULTS, SUPER_PARAM_KEYS } from "./discovery-config.ts";
import type { SuperParamKey } from "./discovery-config.ts";

// Built from the param list so the fixture cannot rot when a Super is added.
const supersAllOff = (): Record<SuperParamKey, boolean> =>
  Object.fromEntries(SUPER_PARAM_KEYS.map((k) => [k, false])) as Record<
    SuperParamKey,
    boolean
  >;
import { nearbyTypesForSupers } from "./google-type-super.ts";
import {
  admitGuestMinReviews,
  admitMapCatalog,
  admitSwipeCatalog,
  clearsMinReviews,
  enabledNearbyTypes,
  evaluatePlaceForMap,
  googleHitClearsMapFloors,
  listedClearsMapPopularity,
  listedMapFilters,
  MAP_MIN_REVIEW_STOPS,
  MAP_MIN_REVIEWS_DEFAULT,
  mapShouldFillGoogle,
  parseMapMinReviews,
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
    businessStatus: "OPERATIONAL",
    reviewCount: null,
    ...over,
  };
}

Deno.test("defaults admit everything and ask Google for every guest family", () => {
  const all = new Set(nearbyTypesForSupers([...SUPER_PARAM_KEYS]));
  assertEquals(new Set(enabledNearbyTypes(MAP)), all);
  assertEquals(mapShouldFillGoogle(true, MAP), true);
  assertEquals(mapShouldFillGoogle(false, MAP), false);
  assertEquals(googleHitClearsMapFloors(hit({ rating: null }), MAP), true);
  assertEquals(
    listedClearsMapPopularity({
      google_stars_overall: null,
      google_review_count: null,
    }, MAP),
    true,
  );
});

Deno.test("googleFill off skips Nearby; a stored family switch does not", () => {
  const all = new Set(nearbyTypesForSupers([...SUPER_PARAM_KEYS]));
  assertEquals(mapShouldFillGoogle(true, { ...MAP, googleFill: false }), false);
  assertEquals(
    mapShouldFillGoogle(true, {
      ...MAP,
      supers: supersAllOff(),
    }),
    true,
  );
  assertEquals(
    new Set(enabledNearbyTypes({
      ...MAP,
      supers: { ...MAP.supers, coffee: false },
    })),
    all,
  );
});

Deno.test("listed Map filters take the stricter of global filters and Map floors", () => {
  const global = {
    ...DISCOVERY_DEFAULTS.filters,
    minRating: 3,
    minReviews: 10,
  };
  assertEquals(
    listedMapFilters(global, { ...MAP, minRating: 4, minReviews: 5 }),
    { ...global, minRating: 4, minReviews: 10 },
  );
});

Deno.test("listed Map filters: the Selected pool always runs the Enriched gate (MESITA-2298)", () => {
  // Mesita Selected IS the enriched, ready set today; a Created row is not
  // Selected and no guest scope shows it, so the gate ignores the global
  // toggle here.
  const global = { ...DISCOVERY_DEFAULTS.filters, requireReady: true };
  assertEquals(listedMapFilters(global, MAP).requireReady, true);
  assertEquals(
    listedMapFilters({ ...global, requireReady: false }, MAP).requireReady,
    true,
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
    listedClearsMapPopularity({
      google_stars_overall: null,
      google_review_count: 0,
    }, high),
    false,
  );
  assertEquals(
    listedClearsMapPopularity({
      google_stars_overall: 4.8,
      google_review_count: 200,
    }, high),
    true,
  );
});

Deno.test("admitMapCatalog still admits Google for a listed place that missed popularity", () => {
  const map = { ...MAP, minPopularity: 0.7 };
  const listed = [
    {
      id: "weak",
      google_place_id: "ChIJ-weak",
      google_stars_overall: null,
      google_review_count: 0,
    },
    {
      id: "strong",
      google_place_id: "ChIJ-strong",
      google_stars_overall: 4.8,
      google_review_count: 200,
    },
  ];
  const google = [
    hit({ placeId: "ChIJ-weak", rating: 4.9 }),
    hit({ placeId: "ChIJ-only", rating: 4.6 }),
  ];
  const got = admitMapCatalog(listed, google, map);
  assertEquals(got.listed.map((r) => r.id), ["strong"]);
  assertEquals(got.google.map((h) => h.placeId), ["ChIJ-weak", "ChIJ-only"]);
});

Deno.test("evaluatePlaceForMap admits a dinner place when Dinner is on", () => {
  const ok = evaluatePlaceForMap(MAP, {
    primaryType: "thai_restaurant",
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

Deno.test("evaluatePlaceForMap ignores stored family switches and still applies floors", () => {
  const barsOnly = {
    ...MAP,
    supers: { ...supersAllOff(), night_out: true },
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
    true,
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
    { id: "rest", category: "thai_restaurant" },
    { id: "bar", category: "bar" },
    { id: "hotel", category: "hotel" },
    { id: "spa", category: "spa" },
    { id: "unk", category: "undefined" },
  ];
  const got = admitSwipeCatalog(listed, MAP);
  assertEquals(got.map((r) => r.id), ["rest", "bar", "spa", "unk"]);
});

Deno.test("admitSwipeCatalog ignores stored family switches", () => {
  const barsOnly = {
    ...MAP,
    supers: { ...supersAllOff(), night_out: true },
  };
  const listed = [
    { id: "rest", category: "restaurant" },
    { id: "club", category: "night_club" },
  ];
  assertEquals(admitSwipeCatalog(listed, barsOnly).map((r) => r.id), [
    "rest",
    "club",
  ]);
});

Deno.test("Atlas leftover slugs admit via Super membership, not Google type", () => {
  assertEquals(primaryTypeClearsMapTypes("undefined", MAP), true);
  assertEquals(primaryTypeClearsMapTypes("board_game_cafe", MAP), true);
  assertEquals(primaryTypeClearsMapTypes("hotel", MAP), false);
  assertEquals(primaryTypeClearsMapTypes("gas_station", MAP), false);
});

Deno.test("guest Google Reviews snaps to 0/10/100/1000, silence is 100+, unknown fails a floor", () => {
  // The sheet's default is 100+ (MESITA-2298): a client that says nothing
  // gets it; a client that says 0 means "any number of reviews".
  assertEquals(MAP_MIN_REVIEWS_DEFAULT, 100);
  assertEquals(parseMapMinReviews(undefined), 100);
  assertEquals(parseMapMinReviews(null), 100);
  assertEquals(parseMapMinReviews("x"), 100);
  assertEquals(parseMapMinReviews(0), 0);
  assertEquals(parseMapMinReviews("0"), 0);
  assertEquals(parseMapMinReviews(-1), 0);
  assertEquals(parseMapMinReviews(10), 10);
  assertEquals(parseMapMinReviews(55), 100);
  // The 10K+ stop is gone (MESITA-2298): an old client's value lands on 1,000.
  assertEquals(parseMapMinReviews(10000), 1000);
  assertEquals(MAP_MIN_REVIEW_STOPS, [0, 10, 100, 1000]);
  assertEquals(clearsMinReviews(null, 0), true);
  assertEquals(clearsMinReviews(null, 10), false);
  assertEquals(clearsMinReviews(9, 10), false);
  assertEquals(clearsMinReviews(10, 10), true);
  const listed = [
    { google_review_count: 3 },
    { google_review_count: 100 },
  ];
  const google = [hit({ reviewCount: 4 }), hit({ reviewCount: 200 })];
  const got = admitGuestMinReviews(listed, google, 10);
  assertEquals(got.listed.map((r) => r.google_review_count), [100]);
  assertEquals(got.google.map((h) => h.reviewCount), [200]);
  const passthrough = admitGuestMinReviews(listed, google, 0);
  assertEquals(passthrough.listed.length, 2);
  assertEquals(passthrough.google.length, 2);
});
