import { assertEquals } from "jsr:@std/assert";
import {
  coerceChannelPolicy,
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
  const verdict = evaluatePlaceForChannel(policy, {
    primaryType: "restaurant",
    rating: 3.0,
    reviewCount: 200,
  });
  assertEquals(verdict.eligible, false);
  if (!verdict.eligible) assertEquals(verdict.code, "below_min_rating");
});

Deno.test("evaluatePlaceForChannel rejects below review floor", () => {
  const policy = coerceChannelPolicy(null, "consumer_add");
  const verdict = evaluatePlaceForChannel(policy, {
    primaryType: "restaurant",
    rating: 4.5,
    reviewCount: 50,
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
