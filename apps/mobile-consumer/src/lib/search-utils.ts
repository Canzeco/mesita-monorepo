import type { Place } from '@/lib/api/places';
import { haversineKm } from '@/lib/utils';

/** Stable token for Google Places autocomplete session billing. */
export function newSessionToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Fill distance_km from live location when coords exist. */
export function withDistances(
  places: Place[],
  userLocation: { lat: number; lng: number } | null,
): Place[] {
  if (!userLocation) return places;
  return places.map((place) => {
    if (typeof place.lat !== 'number' || typeof place.lng !== 'number') {
      return place;
    }
    const km = haversineKm(
      userLocation.lat,
      userLocation.lng,
      place.lat,
      place.lng,
    );
    return { ...place, distance_km: Math.round(km * 10) / 10 };
  });
}
