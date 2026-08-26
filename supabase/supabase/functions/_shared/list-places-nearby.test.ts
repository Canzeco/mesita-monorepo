import { assertEquals } from "jsr:@std/assert@1";
import {
  decideNearby,
  nearestByDistance,
  nearbyBox,
  SEARCH_NEARBY_RADIUS_KM,
} from "./list-places-nearby.ts";

Deno.test("decideNearby: omitted nearby is the newest-first path", () => {
  assertEquals(decideNearby({ limit: 50 }), { mode: "none" });
  assertEquals(decideNearby({ lat: 25.67, lng: -100.31 }), { mode: "none" });
});

Deno.test("decideNearby: nearby true without a pin is invalid", () => {
  assertEquals(decideNearby({ nearby: true }), { mode: "invalid" });
  assertEquals(decideNearby({ nearby: true, lat: 25.67 }), { mode: "invalid" });
});

Deno.test("decideNearby: Monterrey pin is ok at the default 50 km", () => {
  assertEquals(
    decideNearby({ nearby: true, lat: 25.6714, lng: -100.3094 }),
    {
      mode: "ok",
      origin: { lat: 25.6714, lng: -100.3094, radiusKm: SEARCH_NEARBY_RADIUS_KM },
    },
  );
});

Deno.test("nearestByDistance keeps the closest rows, not newest", () => {
  const origin = { lat: 25.67, lng: -100.31, radiusKm: 50 };
  const rows = [
    { id: "far", lat: 25.9, lng: -100.5 },
    { id: "near", lat: 25.671, lng: -100.309 },
    { id: "mid", lat: 25.72, lng: -100.35 },
  ];
  const got = nearestByDistance(rows, origin, (r) => r.lat, (r) => r.lng, 2);
  assertEquals(got.map((r) => r.id), ["near", "mid"]);
});

Deno.test("nearbyBox is a large metro rectangle, not a 0.75° viewport", () => {
  const box = nearbyBox({ lat: 25.6714, lng: -100.3094, radiusKm: 50 });
  assertEquals(box.north - box.south > 0.75, true);
});
