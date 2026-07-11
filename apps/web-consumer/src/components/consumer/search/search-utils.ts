// Small pure helpers for the Search surface: session tokens for Google
// Places autocomplete billing, prediction↔catalog matching, and distance
// derivation/formatting for the rail cards.

import type { Place } from "@/lib/api/places";
import type { PlacePrediction } from "@/lib/api/place-search";
import { haversineKm } from "@/lib/utils";

// Stable per-page-session token, passed on every consumer-suggest-places
// call so Google bills the autocomplete keystrokes as one session.
export function newSessionToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Accent/case-insensitive name key so "Café Nómada" matches "cafe nomada".
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Best-effort resolution of a suggest prediction to a catalog Place.
 *
 * Predictions carry the Google placeId, and the public places projection
 * doesn't expose google_place_id, so the only client-side join available
 * is the (normalized) name. Exact equality ONLY: Mesita-side rows use the
 * place name verbatim as mainText, so equality hits the honest cases,
 * while any substring fallback misroutes look-alikes ("Casa Luminar"
 * contains-matching "Casa Lu"). Predictions the EF stamps with a Mesita
 * id/slug skip this join entirely.
 */
export function matchPredictionToPlace(
  prediction: PlacePrediction,
  places: Place[],
): Place | null {
  const target = normalizeName(prediction.mainText);
  if (!target) return null;
  for (const place of places) {
    if (normalizeName(place.name) === target) return place;
  }
  return null;
}

/** "1.4 km" under 10, "12 km" beyond. */
export function formatKm(km: number): string {
  return `${km < 10 ? km.toFixed(1) : Math.round(km).toString()} km`;
}

/**
 * Fill distance_km from the consumer's live location. Real data only —
 * places without coordinates (or before the geolocation grant) keep
 * distance_km null and the chip simply hides.
 */
export function withDistances(
  places: Place[],
  userLocation: { lat: number; lng: number } | null,
): Place[] {
  if (!userLocation) return places;
  return places.map((place) => {
    if (typeof place.lat !== "number" || typeof place.lng !== "number") {
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
