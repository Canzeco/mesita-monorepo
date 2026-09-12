// Discovery filter engine — Feed and Scroll (MESITA-1792).
//
// Same three guest params as the Search map (MESITA-1790), plus one extra:
// connect current location. Nothing else. Visit/Order, Where search, distance
// slider, When, and category chips are gone from this sheet.
//
//   · Super Category — the seven real families; empty = no constraint.
//   · Scope          — three nested sets: Google ⊃ Mesita Enriched ⊃ Partner.
//                      Default is the middle ring. On Feed/Scroll the pool is
//                      listed Mesita places, so Google == all enriched; the
//                      ring still names the same sets the map uses.
//   · Google reviews — review-count floor 0 / 10 / 100 / 1000 / 10000.
//                      0 = Any. Missing count fails a floor above 0.
//
// Location is not a predicate: it only grants coordinates for ranking.
// Predicates CUT, signals RANK, and a predicate cuts first.

import type { Place } from "@/lib/api/places";
import { type FamilyKey } from "@/lib/place-families";

export type DiscoveryPlacesScope = "partners" | "mesita" | "google";

export const DISCOVERY_PLACES_SCOPE_DEFAULT: DiscoveryPlacesScope = "mesita";

export const DISCOVERY_SCOPE_STOPS = [
  {
    key: "partners",
    tick: "Mesita Partner Places",
    hint: "Mesita Partner Places only",
  },
  {
    key: "mesita",
    tick: "Mesita Enriched Places",
    hint: "Mesita Enriched Places, partners included",
  },
  {
    key: "google",
    tick: "Google Places",
    hint: "Google Places, Mesita places included",
  },
] as const satisfies readonly {
  key: DiscoveryPlacesScope;
  tick: string;
  hint: string;
}[];

export const DISCOVERY_REVIEW_STOPS = [0, 10, 100, 1000, 10000] as const;
export type DiscoveryReviewFloor = (typeof DISCOVERY_REVIEW_STOPS)[number];

export function clampReviewFloor(value: unknown): DiscoveryReviewFloor {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  let best: DiscoveryReviewFloor = 0;
  let bestD = Number.POSITIVE_INFINITY;
  for (const stop of DISCOVERY_REVIEW_STOPS) {
    const d = Math.abs(stop - n);
    if (d < bestD || (d === bestD && stop > best)) {
      best = stop;
      bestD = d;
    }
  }
  return best;
}

export function formatReviewFloor(n: DiscoveryReviewFloor): string {
  if (n === 0) return "Any";
  if (n >= 1000) return `${n / 1000}k+`;
  return `${n}+`;
}

export function parsePlacesScope(value: unknown): DiscoveryPlacesScope {
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    if (key === "partners" || key === "mesita" || key === "google") return key;
  }
  return DISCOVERY_PLACES_SCOPE_DEFAULT;
}

export type DiscoveryFilters = {
  familyKeys: FamilyKey[];
  placesScope: DiscoveryPlacesScope;
  minReviews: DiscoveryReviewFloor;
};

export const DISCOVERY_FILTER_DEFAULTS: DiscoveryFilters = {
  familyKeys: [],
  placesScope: DISCOVERY_PLACES_SCOPE_DEFAULT,
  minReviews: 0,
};

export function hasDiscoveryPredicates(f: DiscoveryFilters): boolean {
  return (
    f.familyKeys.length > 0 ||
    f.placesScope !== DISCOVERY_PLACES_SCOPE_DEFAULT ||
    f.minReviews > 0
  );
}

export function countAppliedDiscoveryFilters(f: DiscoveryFilters): number {
  let n = 0;
  if (f.familyKeys.length > 0) n += 1;
  if (f.placesScope !== DISCOVERY_PLACES_SCOPE_DEFAULT) n += 1;
  if (f.minReviews > 0) n += 1;
  return n;
}

export function discoveryFiltersAreActive(f: DiscoveryFilters): boolean {
  return hasDiscoveryPredicates(f);
}

function googleReviewCount(place: Place): number | null {
  const n = place.google_count ?? place.google_review_count;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function keepPlaceForScope(place: Place, scope: DiscoveryPlacesScope): boolean {
  if (place.googleOnly || place.from_google) return scope === "google";
  if (scope === "partners") return place.partner === true;
  return true;
}

function matchesDiscoveryFilters(place: Place, f: DiscoveryFilters): boolean {
  if (f.familyKeys.length > 0) {
    const hit = f.familyKeys.some((key) => (place.family_keys ?? []).includes(key));
    if (!hit) return false;
  }
  if (!keepPlaceForScope(place, f.placesScope)) return false;
  if (f.minReviews > 0) {
    const count = googleReviewCount(place);
    if (count === null || count < f.minReviews) return false;
  }
  return true;
}

export function applyDiscoveryFilters(
  places: Place[],
  f: DiscoveryFilters,
): Place[] {
  if (!hasDiscoveryPredicates(f)) return places;
  return places.filter((place) => matchesDiscoveryFilters(place, f));
}
