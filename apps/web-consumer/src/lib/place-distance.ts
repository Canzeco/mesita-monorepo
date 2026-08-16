// Real "X km" distances for a place row, measured from a chosen center.
//
// The SSR deck fetch has no user location, so places arrive without
// distance_km. Once the browser hands us a fix (or the consumer picks a zone)
// each place's distance is recomputed from its lat/lng — a real value always
// wins; places missing coords (or a denied prompt) keep whatever distance they
// had, or fall back to a "0 km" placeholder so the chip never just vanishes.
//
// Lives in lib/ rather than a route folder because BOTH discovery surfaces
// need it: Swipe measures the card's chip, Catalog measures the tile's
// subtitle, and the shared distance filter rings the same center on both.

import { haversineKm } from "@/lib/utils";
import type { Coords } from "@/lib/use-user-location";
import type { Place } from "@/lib/api/places";

export function withUserDistance(place: Place, coords: Coords | null): Place {
  if (coords) {
    const lat = toCoord(place.lat);
    const lng = toCoord(place.lng);
    if (lat != null && lng != null) {
      const km = haversineKm(coords.lat, coords.lng, lat, lng);
      const rounded = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
      return { ...place, distance_km: Math.max(rounded, 0.1) };
    }
  }
  return place.distance_km != null ? place : { ...place, distance_km: 0 };
}

function toCoord(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}
