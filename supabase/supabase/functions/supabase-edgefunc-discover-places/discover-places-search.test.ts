import { assertEquals } from "jsr:@std/assert@1";
import { nearbyHitToPlaceLite, parseNearbyCenter } from "./discover-places-search.ts";

Deno.test("parseNearbyCenter: a real coordinate passes through", () => {
  assertEquals(parseNearbyCenter({ lat: 22.15, lng: -100.98 }), { lat: 22.15, lng: -100.98 });
});

Deno.test("parseNearbyCenter: absent, malformed or off-globe points are dropped", () => {
  for (
    const raw of [
      undefined,
      null,
      "22.1,-100.9",
      { lat: "22.1", lng: -100.9 },
      { lat: 22.1 },
      { lat: Number.NaN, lng: 0 },
      { lat: 91, lng: 0 },
      { lat: 0, lng: -181 },
    ]
  ) {
    assertEquals(parseNearbyCenter(raw), null);
  }
});

Deno.test("nearbyHitToPlaceLite: a Nearby hit reads like a Text Search hit", () => {
  assertEquals(
    nearbyHitToPlaceLite({
      placeId: "ChIJyY3ApaiZKoQRddEgz8nCoaQ",
      name: "Dos Amores Brunch & Meal",
      address: "Parque Central 455, San Luis Potosí",
      lat: 22.15,
      lng: -100.98,
      rating: 4.7,
      primaryType: "brunch_restaurant",
      businessStatus: "OPERATIONAL",
      reviewCount: 266,
    }),
    {
      id: "ChIJyY3ApaiZKoQRddEgz8nCoaQ",
      displayName: "Dos Amores Brunch & Meal",
      formattedAddress: "Parque Central 455, San Luis Potosí",
      lat: 22.15,
      lng: -100.98,
      rating: 4.7,
      userRatingCount: 266,
      primaryType: "brunch_restaurant",
      existsInMesita: false,
      createdAt: null,
      updatedAt: null,
    },
  );
});
