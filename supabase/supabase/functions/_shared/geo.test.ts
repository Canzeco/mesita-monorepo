import { assertEquals } from "jsr:@std/assert@1";
import {
  applyBboxPredicate,
  BBOX_MAX_SPAN_DEG,
  decideBbox,
  decideNearby,
  haversineKm,
  nearbyBbox,
  NEARBY_DEFAULT_RADIUS_KM,
  sortByDistance,
  type BboxQuery,
} from "./geo.ts";

type Call = { op: string; col?: string; val?: unknown };

class FakeBboxQuery implements BboxQuery<FakeBboxQuery> {
  calls: Call[] = [];
  gte(col: string, val: unknown) {
    this.calls.push({ op: "gte", col, val });
    return this;
  }
  lte(col: string, val: unknown) {
    this.calls.push({ op: "lte", col, val });
    return this;
  }
  or(filters: string) {
    this.calls.push({ op: "or", val: filters });
    return this;
  }
}

Deno.test("decideBbox: omitted keys are the no-geo path", () => {
  assertEquals(decideBbox({ limit: 200 }), { mode: "none" });
  assertEquals(decideBbox({}), { mode: "none" });
});

Deno.test("decideBbox: partial box is invalid, not a half-filter", () => {
  assertEquals(decideBbox({ south: 25, north: 26 }), { mode: "invalid" });
  assertEquals(decideBbox({ south: 25, west: -100, north: 26, east: NaN }), {
    mode: "invalid",
  });
  assertEquals(decideBbox({ south: 26, west: -100, north: 25, east: -99 }), {
    mode: "invalid",
  });
});

Deno.test("decideBbox: Monterrey neighborhood is ok", () => {
  assertEquals(
    decideBbox({
      south: 25.64,
      west: -100.35,
      north: 25.7,
      east: -100.28,
    }),
    {
      mode: "ok",
      bbox: { south: 25.64, west: -100.35, north: 25.7, east: -100.28 },
    },
  );
});

Deno.test("decideBbox: city-scale span is overspan, not newest-200", () => {
  assertEquals(BBOX_MAX_SPAN_DEG, 0.75);
  assertEquals(
    decideBbox({
      south: 25,
      west: -101,
      north: 26.5,
      east: -99,
    }),
    { mode: "overspan" },
  );
});

Deno.test("decideBbox: dateline west>east is valid when the wrap is small", () => {
  const got = decideBbox({
    south: 0,
    west: 179.8,
    north: 0.1,
    east: -179.8,
  });
  assertEquals(got.mode, "ok");
});

Deno.test("applyBboxPredicate keeps a NE-corner pin (no radius trim)", () => {
  const q = applyBboxPredicate(new FakeBboxQuery(), {
    south: 25.64,
    west: -100.35,
    north: 25.7,
    east: -100.28,
  });
  assertEquals(q.calls, [
    { op: "gte", col: "lat", val: 25.64 },
    { op: "lte", col: "lat", val: 25.7 },
    { op: "gte", col: "lng", val: -100.35 },
    { op: "lte", col: "lng", val: -100.28 },
  ]);
});

Deno.test("decideNearby: omitted keys are the no-geo path", () => {
  assertEquals(decideNearby({ limit: 50 }), { mode: "none" });
  assertEquals(decideNearby({ south: 25, west: -100, north: 26, east: -99 }), {
    mode: "none",
  });
});

Deno.test("decideNearby: one of lat/lng is invalid, not half-geo", () => {
  assertEquals(decideNearby({ lat: 25.67 }), { mode: "invalid" });
  assertEquals(decideNearby({ lng: -100.3 }), { mode: "invalid" });
  assertEquals(decideNearby({ lat: 25.67, lng: NaN }), { mode: "invalid" });
});

Deno.test("decideNearby: Monterrey pin defaults to the large radius", () => {
  assertEquals(NEARBY_DEFAULT_RADIUS_KM, 500);
  assertEquals(decideNearby({ lat: 25.6714, lng: -100.3094 }), {
    mode: "ok",
    lat: 25.6714,
    lng: -100.3094,
    radiusKm: 500,
  });
});

Deno.test("nearbyBbox is city-scale, not a camera rectangle", () => {
  const box = nearbyBbox(25.6714, -100.3094, 500);
  assertEquals(box.north - box.south > 4, true);
  assertEquals(box.east - box.west > 4, true);
});

Deno.test("sortByDistance puts the nearest pin first", () => {
  const origin = { lat: 25.6714, lng: -100.3094 };
  const rows = [
    { id: "far", lat: 19.43, lng: -99.13 },
    { id: "near", lat: 25.66, lng: -100.31 },
    { id: "mid", lat: 25.8, lng: -100.4 },
  ];
  const ordered = sortByDistance(rows, origin.lat, origin.lng);
  assertEquals(ordered.map((r) => r.id), ["near", "mid", "far"]);
  assertEquals(
    haversineKm(origin.lat, origin.lng, 25.66, -100.31) < 5,
    true,
  );
});

Deno.test("applyBboxPredicate: dateline is two lng ranges, not 400", () => {
  const q = applyBboxPredicate(new FakeBboxQuery(), {
    south: 0,
    west: 179.8,
    north: 0.1,
    east: -179.8,
  });
  assertEquals(q.calls.at(-1), {
    op: "or",
    val: "and(lng.gte.179.8,lng.lte.180),and(lng.gte.-180,lng.lte.-179.8)",
  });
});
