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
  clearsMinReviews,
  enabledNearbyTypes,
  evaluatePlaceForMap,
  guestReviewFloor,
  listedClearsMapPopularity,
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
    openNow: null,
    ...over,
  };
}

Deno.test("defaults admit everything and ask Google for every guest family", () => {
  const all = new Set(nearbyTypesForSupers([...SUPER_PARAM_KEYS]));
  assertEquals(new Set(enabledNearbyTypes(MAP)), all);
  assertEquals(mapShouldFillGoogle(true, MAP), true);
  assertEquals(mapShouldFillGoogle(false, MAP), false);
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

Deno.test("minPopularity reads the Area pipeline's Popularity — unrated scores 0 (MESITA-2328)", () => {
  // ln(1 + 4.8 × 200) / ln(1 + 4.5 × 1000) ≈ 0.82 against the default
  // reference; an unrated row scores 0, so any floor above 0 drops it.
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
  assertEquals(
    listedClearsMapPopularity({
      google_stars_overall: null,
      google_review_count: null,
    }, { ...MAP, minPopularity: 0.01 }),
    false,
  );
  // The operator's reference moves the score: a 100-review reference makes
  // the same place a full 1.
  assertEquals(
    listedClearsMapPopularity(
      { google_stars_overall: 4.5, google_review_count: 100 },
      { ...MAP, minPopularity: 0.99 },
      { referenceRating: 4.5, referenceReviews: 100 },
    ),
    true,
  );
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

Deno.test("Map types admit F&B, bars and spas, and drop hotels", () => {
  const admits = (category: string) => primaryTypeClearsMapTypes(category, MAP);
  assertEquals(
    ["thai_restaurant", "bar", "hotel", "spa", "undefined"].filter(admits),
    ["thai_restaurant", "bar", "spa", "undefined"],
  );
});

Deno.test("Map types ignore stored family switches", () => {
  const barsOnly = {
    ...MAP,
    supers: { ...supersAllOff(), night_out: true },
  };
  assertEquals(primaryTypeClearsMapTypes("restaurant", barsOnly), true);
  assertEquals(primaryTypeClearsMapTypes("night_club", barsOnly), true);
});

Deno.test("Atlas leftover slugs admit via Super membership, not Google type", () => {
  assertEquals(primaryTypeClearsMapTypes("undefined", MAP), true);
  assertEquals(primaryTypeClearsMapTypes("board_game_cafe", MAP), true);
  assertEquals(primaryTypeClearsMapTypes("hotel", MAP), false);
  assertEquals(primaryTypeClearsMapTypes("gas_station", MAP), false);
});

Deno.test("guest Google Reviews snaps to 10/100/1000, silence is 100+, unknown fails a floor", () => {
  // The sheet's default is 100+ (MESITA-2298): a client that says nothing
  // gets it. The minimum is 10+ (MESITA-2336): a client that still says 0
  // (the retired 0+) lands on 10+, never on "any number of reviews".
  assertEquals(MAP_MIN_REVIEWS_DEFAULT, 100);
  assertEquals(parseMapMinReviews(undefined), 100);
  assertEquals(parseMapMinReviews(null), 100);
  assertEquals(parseMapMinReviews("x"), 100);
  assertEquals(parseMapMinReviews(0), 10);
  assertEquals(parseMapMinReviews("0"), 10);
  assertEquals(parseMapMinReviews(-1), 10);
  assertEquals(parseMapMinReviews(5), 10);
  assertEquals(parseMapMinReviews(10), 10);
  assertEquals(parseMapMinReviews(55), 100);
  // The 10K+ stop is gone (MESITA-2298): an old client's value lands on 1,000.
  assertEquals(parseMapMinReviews(10000), 1000);
  assertEquals(MAP_MIN_REVIEW_STOPS, [10, 100, 1000]);
  // Mesita Selected still has no review floor of any kind.
  assertEquals(guestReviewFloor("selected", 0), 0);
  assertEquals(guestReviewFloor("selected", 1000), 0);
  assertEquals(guestReviewFloor("google", 0), 10);
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
  // The floor is Google's cut only: a Mesita Selected row with 3 reviews
  // stays on the map (MESITA-2305).
  assertEquals(got.listed.map((r) => r.google_review_count), [3, 100]);
  assertEquals(got.google.map((h) => h.reviewCount), [200]);
  const passthrough = admitGuestMinReviews(listed, google, 0);
  assertEquals(passthrough.listed.length, 2);
  assertEquals(passthrough.google.length, 2);
});

Deno.test("guestReviewFloor: the Selected scope has no floor, the Google scope snaps and defaults to 100+ (MESITA-2298)", () => {
  // Mesita Selected is never gated by a review count, whatever the sheet
  // says: the ONLY way to obtain a floor returns 0 for it by construction.
  assertEquals(guestReviewFloor("selected", 1000), 0);
  assertEquals(guestReviewFloor("selected", "100"), 0);
  assertEquals(guestReviewFloor("selected", undefined), 0);
  // Google Places: the sheet's stop, snapped; silence is the sheet's default.
  assertEquals(guestReviewFloor("google", 1000), 1000);
  assertEquals(guestReviewFloor("google", 10000), 1000);
  // The minimum stop is 10+ (MESITA-2336): a 0 is never "any reviews".
  assertEquals(guestReviewFloor("google", 0), 10);
  assertEquals(guestReviewFloor("google", undefined), MAP_MIN_REVIEWS_DEFAULT);
  assertEquals(guestReviewFloor("google", undefined), 100);
});
