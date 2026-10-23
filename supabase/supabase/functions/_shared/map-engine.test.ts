import { assertEquals } from "jsr:@std/assert@1";
import { DISCOVERY_DEFAULTS, SUPER_PARAM_KEYS } from "./discovery-config.ts";
import { nearbyTypesForSupers } from "./google-type-super.ts";
import {
  clearsMinReviews,
  enabledNearbyTypes,
  evaluatePlaceForMap,
  listedClearsMapPopularity,
  mapShouldFillGoogle,
  primaryTypeClearsMapTypes,
} from "./map-engine.ts";

const MAP = DISCOVERY_DEFAULTS.map;


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

Deno.test("both Google switches off skips Nearby; either one on calls it (MESITA-2703)", () => {
  assertEquals(mapShouldFillGoogle(true, { ...MAP, googlePopular: 0, googleClosest: 0 }), false);
  assertEquals(mapShouldFillGoogle(true, { ...MAP, googlePopular: 20, googleClosest: 0 }), true);
  assertEquals(mapShouldFillGoogle(true, { ...MAP, googlePopular: 0, googleClosest: 20 }), true);
  assertEquals(mapShouldFillGoogle(false, MAP), false);
});

Deno.test("minPopularity reads the Area pipeline's Popularity — unrated scores 0 (MESITA-2328)", () => {
  // (4.8 ÷ 5) × 200 ÷ (200 + 100) = 0.64 at the default K (MESITA-2347);
  // an unrated row scores 0, so any floor above 0 drops it.
  const high = { ...MAP, minPopularity: 0.6 };
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
  // The operator's K moves the score: 4.5★ × 100 is 0.9 × 100/(100+K) —
  // 0.45 at K = 100 (the default), 0.82 at K = 10 (MESITA-2347).
  assertEquals(
    listedClearsMapPopularity(
      { google_stars_overall: 4.5, google_review_count: 100 },
      { ...MAP, minPopularity: 0.8 },
    ),
    false,
  );
  assertEquals(
    listedClearsMapPopularity(
      { google_stars_overall: 4.5, google_review_count: 100 },
      { ...MAP, minPopularity: 0.8 },
      { halfReviews: 10 },
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

Deno.test("evaluatePlaceForMap admits every family and still applies floors", () => {
  assertEquals(
    evaluatePlaceForMap(MAP, {
      primaryType: "night_club",
      rating: 4.5,
      reviewCount: 10,
    }).eligible,
    true,
  );
  assertEquals(
    evaluatePlaceForMap(MAP, {
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

Deno.test("Atlas leftover slugs admit via Super membership, not Google type", () => {
  assertEquals(primaryTypeClearsMapTypes("undefined", MAP), true);
  assertEquals(primaryTypeClearsMapTypes("board_game_cafe", MAP), true);
  assertEquals(primaryTypeClearsMapTypes("hotel", MAP), false);
  assertEquals(primaryTypeClearsMapTypes("gas_station", MAP), false);
});

Deno.test("clearsMinReviews: unknown fails a floor that is on; 0 is off", () => {
  assertEquals(clearsMinReviews(null, 0), true);
  assertEquals(clearsMinReviews(null, 10), false);
  assertEquals(clearsMinReviews(9, 10), false);
  assertEquals(clearsMinReviews(10, 10), true);
});
