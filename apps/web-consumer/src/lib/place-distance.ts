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

import { useMemo } from "react";
import { haversineKm } from "@/lib/utils";
import { useUserLocation, type Coords } from "@/lib/use-user-location";
import { useActiveLocation } from "@/lib/active-location";
import type { Place } from "@/lib/api/places";

/** Km from `from` to (lat, lng), rounded like every distance chip: one
 *  decimal under 10 km, whole km above, never below 0.1. Null without
 *  coordinates on either end. */
function kmFrom(from: Coords | null, latRaw: unknown, lngRaw: unknown): number | null {
  if (!from) return null;
  const lat = toCoord(latRaw);
  const lng = toCoord(lngRaw);
  if (lat == null || lng == null) return null;
  const km = haversineKm(from.lat, from.lng, lat, lng);
  const rounded = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
  return Math.max(rounded, 0.1);
}

export function withUserDistance(place: Place, coords: Coords | null): Place {
  const km = kmFrom(coords, place.lat, place.lng);
  if (km != null) return { ...place, distance_km: km };
  return place.distance_km != null ? place : { ...place, distance_km: 0 };
}

/** THE PLACE SCREEN'S DISTANCE (MESITA-2644, Pato: "after zone, distance is
 *  missing"). get-overview sends no distance, so the facts row's fact after
 *  the zone never drew. Measured here, before the place reaches
 *  `@mesita/place-profile`: from the device fix, else Home's chosen saved
 *  location; with neither the place keeps what it had (a Google card's own
 *  distance, or none). No city stand-in (MESITA-2626). */
export function useMeasuredPlace<T extends { lat: number | null; lng: number | null; distance_km: number }>(
  place: T,
): T {
  const fix = useUserLocation();
  const active = useActiveLocation();
  const fromLat = fix?.lat ?? active?.lat ?? null;
  const fromLng = fix ? fix.lng : (active?.lng ?? null);
  return useMemo(() => {
    const from = fromLat != null && fromLng != null ? { lat: fromLat, lng: fromLng } : null;
    const km = kmFrom(from, place.lat, place.lng);
    return km != null ? { ...place, distance_km: km } : place;
  }, [place, fromLat, fromLng]);
}

function toCoord(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}
