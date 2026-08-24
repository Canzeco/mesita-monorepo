import { assertEquals } from "jsr:@std/assert";
import {
  applyPlacesAutocompleteRegion,
  applyPlacesTextSearchRegion,
  coerceChannelPolicy,
  DEFAULT_REGION,
  evaluatePlaceForChannel,
  familiesForGoogleType,
  familyForGoogleType,
} from "./sourcing.ts";

Deno.test("familyForGoogleType maps known types", () => {
  assertEquals(familyForGoogleType("mexican_restaurant"), "restaurants");
  assertEquals(familyForGoogleType("night_club"), "bars_nightlife");
  assertEquals(familyForGoogleType("gas_station"), null);
});

Deno.test("familiesForGoogleType returns dual-family keys for gastropub", () => {
  assertEquals(familiesForGoogleType("gastropub"), [
    "restaurants",
    "bars_nightlife",
  ]);
});

Deno.test("familiesForGoogleType accepts _restaurant alias", () => {
  assertEquals(familiesForGoogleType("fine_dining"), ["restaurants"]);
  assertEquals(familiesForGoogleType("FINE_DINING"), ["restaurants"]);
});

Deno.test("evaluatePlaceForChannel rejects ineligible family", () => {
  const policy = coerceChannelPolicy(
    { enabled: true, families: ["restaurants"], minRating: 0, minReviews: 0 },
    "consumer_add",
  );
  const verdict = evaluatePlaceForChannel(policy, {
    primaryType: "night_club",
    rating: 4.5,
    reviewCount: 200,
  });
  assertEquals(verdict.eligible, false);
  if (!verdict.eligible) assertEquals(verdict.code, "family_not_eligible");
});

Deno.test("evaluatePlaceForChannel rejects below rating floor", () => {
  const policy = coerceChannelPolicy(null, "consumer_add");
  assertEquals(policy.minRating, 2);
  const verdict = evaluatePlaceForChannel(policy, {
    primaryType: "restaurant",
    rating: 1.5,
    reviewCount: 200,
  });
  assertEquals(verdict.eligible, false);
  if (!verdict.eligible) assertEquals(verdict.code, "below_min_rating");
});

Deno.test("evaluatePlaceForChannel rejects below review floor", () => {
  const policy = coerceChannelPolicy(null, "consumer_add");
  assertEquals(policy.minReviews, 50);
  const verdict = evaluatePlaceForChannel(policy, {
    primaryType: "restaurant",
    rating: 4.5,
    reviewCount: 49,
  });
  assertEquals(verdict.eligible, false);
  if (!verdict.eligible) assertEquals(verdict.code, "below_min_reviews");
});

Deno.test("evaluatePlaceForChannel accepts qualifying place", () => {
  const policy = coerceChannelPolicy(null, "consumer_add");
  const verdict = evaluatePlaceForChannel(policy, {
    primaryType: "restaurant",
    rating: 4.5,
    reviewCount: 150,
  });
  assertEquals(verdict, { eligible: true });
});

Deno.test("consumer_search fallback accepts 1★ night_club with 50+ reviews", () => {
  const policy = coerceChannelPolicy(null, "consumer_search");
  assertEquals(policy.minRating, 1);
  assertEquals(policy.minReviews, 50);
  const verdict = evaluatePlaceForChannel(policy, {
    primaryType: "night_club",
    rating: 2.4,
    reviewCount: 88,
  });
  assertEquals(verdict, { eligible: true });
});

Deno.test("consumer_search fallback accepts cake_shop above 1★ / 50 reviews", () => {
  const policy = coerceChannelPolicy(null, "consumer_search");
  const verdict = evaluatePlaceForChannel(policy, {
    primaryType: "cake_shop",
    rating: 3.3,
    reviewCount: 118,
  });
  assertEquals(verdict, { eligible: true });
});

Deno.test("consumer_search fallback rejects below review floor", () => {
  const policy = coerceChannelPolicy(null, "consumer_search");
  const verdict = evaluatePlaceForChannel(policy, {
    primaryType: "restaurant",
    rating: 4.5,
    reviewCount: 20,
  });
  assertEquals(verdict.eligible, false);
  if (!verdict.eligible) assertEquals(verdict.code, "below_min_reviews");
});

// A type listed under two families must be admitted by EITHER of them —
// gastropub is both a restaurant and a bar. Regression: the map was built
// first-match-wins, so gastropub silently bound to restaurants only and a
// bars-only policy rejected it (MESITA-631).
Deno.test("dual-family type is admitted by either family", () => {
  const barsOnly = coerceChannelPolicy(
    { enabled: true, families: ["bars_nightlife"], minRating: 0, minReviews: 0 },
    "consumer_add",
  );
  const restaurantsOnly = coerceChannelPolicy(
    { enabled: true, families: ["restaurants"], minRating: 0, minReviews: 0 },
    "consumer_add",
  );
  const gastropub = { primaryType: "gastropub", rating: 4.8, reviewCount: 5000 };

  assertEquals(evaluatePlaceForChannel(barsOnly, gastropub).eligible, true);
  assertEquals(evaluatePlaceForChannel(restaurantsOnly, gastropub).eligible, true);

  // A single-family type is still gated by its own family.
  const nightClub = { primaryType: "night_club", rating: 4.8, reviewCount: 5000 };
  assertEquals(evaluatePlaceForChannel(restaurantsOnly, nightClub).eligible, false);
  assertEquals(evaluatePlaceForChannel(barsOnly, nightClub).eligible, true);
});

Deno.test("old blob without region keeps country-only MX bias", () => {
  const policy = coerceChannelPolicy(
    { enabled: true, families: ["restaurants"], minRating: 0, minReviews: 0 },
    "admin_search",
  );
  assertEquals(policy.region, DEFAULT_REGION);
});

Deno.test("empty country turns region off", () => {
  const policy = coerceChannelPolicy(
    {
      enabled: true,
      families: ["restaurants"],
      minRating: 0,
      minReviews: 0,
      region: { country: "", lat: 19.4, lng: -99.1, radiusKm: 10, restrict: false },
    },
    "admin_search",
  );
  const body: Record<string, unknown> = { textQuery: "tacos" };
  applyPlacesTextSearchRegion(body, policy);
  assertEquals(body.regionCode, undefined);
  assertEquals("locationBias" in body, true);
});

const restaurant = { primaryType: "restaurant", rating: 4.5, reviewCount: 200 };

Deno.test("restrict rejects a place outside the country", () => {
  const policy = coerceChannelPolicy(
    {
      enabled: true,
      families: ["restaurants"],
      minRating: 0,
      minReviews: 0,
      region: { country: "MX", lat: 19.4326, lng: -99.1332, radiusKm: 0, restrict: true },
    },
    "consumer_add",
  );
  const verdict = evaluatePlaceForChannel(policy, restaurant, {
    lat: 40.7,
    lng: -74.0,
    country: "US",
  });
  assertEquals(verdict.eligible, false);
  if (!verdict.eligible) assertEquals(verdict.code, "outside_region");
});

Deno.test("restrict rejects a place outside the radius", () => {
  const policy = coerceChannelPolicy(
    {
      enabled: true,
      families: ["restaurants"],
      minRating: 0,
      minReviews: 0,
      region: { country: "MX", lat: 19.4326, lng: -99.1332, radiusKm: 20, restrict: true },
    },
    "consumer_add",
  );
  const verdict = evaluatePlaceForChannel(policy, restaurant, {
    lat: 25.6866,
    lng: -100.3161,
    country: "MX",
  });
  assertEquals(verdict.eligible, false);
  if (!verdict.eligible) assertEquals(verdict.code, "outside_region");
});

Deno.test("bias does not reject an outsider after Google returns it", () => {
  const policy = coerceChannelPolicy(
    {
      enabled: true,
      families: ["restaurants"],
      minRating: 0,
      minReviews: 0,
      region: { country: "MX", lat: 19.4326, lng: -99.1332, radiusKm: 20, restrict: false },
    },
    "consumer_add",
  );
  const verdict = evaluatePlaceForChannel(policy, restaurant, {
    lat: 25.6866,
    lng: -100.3161,
    country: "MX",
  });
  assertEquals(verdict, { eligible: true });
});

Deno.test("Autocomplete gets includedRegionCodes and a circle bias", () => {
  const policy = coerceChannelPolicy(
    {
      enabled: true,
      families: ["restaurants"],
      minRating: 0,
      minReviews: 0,
      region: { country: "MX", lat: 19.4326, lng: -99.1332, radiusKm: 12, restrict: false },
    },
    "consumer_search",
  );
  const body: Record<string, unknown> = { input: "taco" };
  applyPlacesAutocompleteRegion(body, policy);
  assertEquals(body.regionCode, "MX");
  assertEquals(body.includedRegionCodes, ["MX"]);
  assertEquals("locationBias" in body, true);
  assertEquals("locationRestriction" in body, false);
});

Deno.test("Text Search restrict uses a rectangle, never a circle", () => {
  const policy = coerceChannelPolicy(
    {
      enabled: true,
      families: ["restaurants"],
      minRating: 0,
      minReviews: 0,
      region: { country: "MX", lat: 19.4326, lng: -99.1332, radiusKm: 8, restrict: true },
    },
    "memo_search",
  );
  const body: Record<string, unknown> = { textQuery: "mezcal" };
  applyPlacesTextSearchRegion(body, policy);
  const restriction = body.locationRestriction as { rectangle?: unknown; circle?: unknown };
  assertEquals(Boolean(restriction?.rectangle), true);
  assertEquals(restriction?.circle, undefined);
});

Deno.test("Text Search bias over 50 km uses a rectangle", () => {
  const policy = coerceChannelPolicy(
    {
      enabled: true,
      families: ["restaurants"],
      minRating: 0,
      minReviews: 0,
      region: { country: "MX", lat: 19.4326, lng: -99.1332, radiusKm: 80, restrict: false },
    },
    "admin_search",
  );
  const body: Record<string, unknown> = { textQuery: "taco" };
  applyPlacesTextSearchRegion(body, policy);
  const bias = body.locationBias as { rectangle?: unknown; circle?: unknown };
  assertEquals(Boolean(bias?.rectangle), true);
  assertEquals(bias?.circle, undefined);
});
