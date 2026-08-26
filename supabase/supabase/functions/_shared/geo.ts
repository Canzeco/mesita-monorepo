// Geo helpers shared by the place-pool, search, and distance EFs.

// Haversine distance in km between two lat/lng pairs. Returns +Infinity if
// either point is missing so the caller's `<= radius` filter cleanly drops it.
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number | null,
  lng2: number | null,
): number {
  if (lat2 == null || lng2 == null) return Number.POSITIVE_INFINITY;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Bounding-box deltas for a radius-around-a-point search. Latitude is ~111km
// per degree everywhere; longitude shrinks with cos(lat) toward the poles so
// we widen the lng span proportionally. The cos floor (0.1) keeps the math
// finite at very high latitudes — Mesita doesn't operate there but cheap to
// be defensive.
export function radiusBoundingBox(
  lat: number,
  radiusKm: number,
): { latDelta: number; lngDelta: number } {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
  return { latDelta, lngDelta };
}

/** Viewport span clamp for consumer-web-list-places. Degrees, not km. */
export const BBOX_MAX_SPAN_DEG = 0.75;

export type GeoBbox = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export type BboxDecision =
  | { mode: "none" }
  | { mode: "invalid" }
  | { mode: "overspan" }
  | { mode: "ok"; bbox: GeoBbox };

const BBOX_KEYS = ["south", "west", "north", "east"] as const;

function finiteNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function lngSpanDeg(west: number, east: number): number {
  if (west <= east) return east - west;
  return 180 - west + (east + 180);
}

function wrapLng(lng: number): number {
  let x = lng;
  while (x <= -180) x += 360;
  while (x > 180) x -= 360;
  return x;
}

/** Search map catalog radius. Google Nearby Search (New) caps the circle at 50 km. */
export const NEARBY_RADIUS_KM = 50;

export type NearbyDecision =
  | { mode: "none" }
  | { mode: "invalid" }
  | { mode: "ok"; center: { lat: number; lng: number } };

/** POST `{ nearby: true, lat, lng }`. nearby wins over bbox when both are sent. */
export function decideNearby(body: Record<string, unknown>): NearbyDecision {
  if (body.nearby !== true && body.nearby !== "true") return { mode: "none" };
  const lat = finiteNumber(body.lat);
  const lng = finiteNumber(body.lng);
  if (
    lat == null || lng == null || lat < -90 || lat > 90 || lng < -180 ||
    lng > 180
  ) {
    return { mode: "invalid" };
  }
  return { mode: "ok", center: { lat, lng } };
}

export function circleBbox(
  center: { lat: number; lng: number },
  radiusKm: number,
): GeoBbox {
  const { latDelta, lngDelta } = radiusBoundingBox(center.lat, radiusKm);
  return {
    south: Math.max(-90, center.lat - latDelta),
    north: Math.min(90, center.lat + latDelta),
    west: wrapLng(center.lng - lngDelta),
    east: wrapLng(center.lng + lngDelta),
  };
}

export function bboxCenter(bbox: GeoBbox): { lat: number; lng: number } {
  const lat = (bbox.south + bbox.north) / 2;
  if (bbox.west <= bbox.east) {
    return { lat, lng: (bbox.west + bbox.east) / 2 };
  }
  let lng = bbox.west + lngSpanDeg(bbox.west, bbox.east) / 2;
  if (lng > 180) lng -= 360;
  return { lat, lng };
}

export function takeClosest<T extends { lat?: number | null; lng?: number | null }>(
  rows: T[],
  center: { lat: number; lng: number },
  limit: number,
): T[] {
  return [...rows]
    .sort((a, b) => {
      const da = haversineKm(center.lat, center.lng, a.lat ?? null, a.lng ?? null);
      const db = haversineKm(center.lat, center.lng, b.lat ?? null, b.lng ?? null);
      return da - db;
    })
    .slice(0, limit);
}

/** POST body: all four numbers or none. GET callers never send these keys. */
export function decideBbox(body: Record<string, unknown>): BboxDecision {
  const present = BBOX_KEYS.filter((k) => body[k] != null).length;
  if (present === 0) return { mode: "none" };
  if (present !== 4) return { mode: "invalid" };

  const south = finiteNumber(body.south);
  const west = finiteNumber(body.west);
  const north = finiteNumber(body.north);
  const east = finiteNumber(body.east);
  if (south == null || west == null || north == null || east == null) {
    return { mode: "invalid" };
  }
  if (south >= north) return { mode: "invalid" };
  if (south < -90 || north > 90 || west < -180 || west > 180 || east < -180 ||
    east > 180) {
    return { mode: "invalid" };
  }

  const span = Math.max(north - south, lngSpanDeg(west, east));
  if (span > BBOX_MAX_SPAN_DEG) return { mode: "overspan" };
  return { mode: "ok", bbox: { south, west, north, east } };
}

/** Rectangle only — never haversine-trim the corners. west > east is dateline. */
export type BboxQuery<T> = {
  gte: (col: string, val: unknown) => T;
  lte: (col: string, val: unknown) => T;
  or: (filters: string) => T;
};

export function applyBboxPredicate<T extends BboxQuery<T>>(
  query: T,
  bbox: GeoBbox,
): T {
  const q = query.gte("lat", bbox.south).lte("lat", bbox.north);
  if (bbox.west <= bbox.east) {
    return q.gte("lng", bbox.west).lte("lng", bbox.east);
  }
  return q.or(
    `and(lng.gte.${bbox.west},lng.lte.180),and(lng.gte.-180,lng.lte.${bbox.east})`,
  );
}
