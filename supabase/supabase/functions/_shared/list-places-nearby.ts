// Search map pool: nearest N listed places around a pin, large radius.
// Viewport bbox is a different POST shape and is not this path.

import { haversineKm, radiusBoundingBox, type GeoBbox } from "./geo.ts";

export const SEARCH_NEARBY_RADIUS_KM = 50;
export const SEARCH_NEARBY_LIMIT = 50;
export const SEARCH_NEARBY_TINY = 10;
export const SEARCH_NEARBY_FETCH = 200;

export type NearbyOrigin = { lat: number; lng: number; radiusKm: number };

export function decideNearby(body: Record<string, unknown>):
  | { mode: "none" }
  | { mode: "invalid" }
  | { mode: "ok"; origin: NearbyOrigin } {
  if (body.nearby !== true && body.nearby !== "true") return { mode: "none" };
  const lat = finiteNumber(body.lat);
  const lng = finiteNumber(body.lng);
  if (lat == null || lng == null) return { mode: "invalid" };
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return { mode: "invalid" };
  const raw = finiteNumber(body.radiusKm);
  const radiusKm = raw == null
    ? SEARCH_NEARBY_RADIUS_KM
    : Math.min(200, Math.max(1, raw));
  return { mode: "ok", origin: { lat, lng, radiusKm } };
}

function finiteNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function nearbyBox(origin: NearbyOrigin): GeoBbox {
  const { latDelta, lngDelta } = radiusBoundingBox(origin.lat, origin.radiusKm);
  return {
    south: Math.max(-90, origin.lat - latDelta),
    north: Math.min(90, origin.lat + latDelta),
    west: wrapLng(origin.lng - lngDelta),
    east: wrapLng(origin.lng + lngDelta),
  };
}

function wrapLng(lng: number): number {
  if (lng < -180) return lng + 360;
  if (lng > 180) return lng - 360;
  return lng;
}

export function nearestByDistance<T>(
  rows: T[],
  origin: NearbyOrigin,
  latOf: (row: T) => number | null,
  lngOf: (row: T) => number | null,
  limit: number,
): T[] {
  return rows
    .map((row) => ({
      row,
      km: haversineKm(origin.lat, origin.lng, latOf(row), lngOf(row)),
    }))
    .filter((x) => x.km <= origin.radiusKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, limit)
    .map((x) => x.row);
}
