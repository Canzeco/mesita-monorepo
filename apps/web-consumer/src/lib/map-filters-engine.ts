// Map filters — Search only. Places scope + Families + Google Reviews.
// How many is operator `map.pinCount`; the circle is operator `map.radiusKm`.
//
// TWO SCOPES (MESITA-2298), and the guest picks one by name:
//
//   Google Places     every Google place near the guest, a Mesita place
//                     winning its own Google id — gray pins, red where
//                     Mesita wrote the profile
//   Mesita Selected   the places Mesita has written up (enriched, ready)
//                     — red pins
//
// Internally the sets still nest (Google Places ⊃ Mesita Places ⊃ Mesita
// Enriched Places) and the pin tones keep three colours (`search-pins.ts`),
// but the sheet names two sets and the word Enriched never reaches a guest
// here. Default is Mesita Selected — a discovery surface opens on the
// places Mesita has actually written up.
//
// Families is All Families (the default: no family cut) or any set of the
// fifteen; the server turns the set into the union of their Google types.
// Google Reviews is the review-COUNT floor, 0+ / 10+ / 100+ / 1,000+,
// default 100+; applied by the server after Google answers, never as a
// Nearby API param, never a refill, and never to Mesita Selected.
//
// The SERVER is the one selector (MESITA-1699 law kept): SearchClient
// posts these three params and paints what comes back. Distance and time
// stay off this surface: the camera already bounds the set.

import type { Place } from "@/lib/api/places";
import { type FamilyKey } from "@/lib/place-families";

/** The set the guest picked. Named, never an ordinal — the wire carries
 *  this word. */
export type MapPlacesScope = "google" | "selected";

/** Mesita Selected: the places Mesita has written up. */
export const MAP_PLACES_SCOPE_DEFAULT: MapPlacesScope = "selected";

const MAP_PLACES_SCOPES = [
  "google",
  "selected",
] as const satisfies readonly MapPlacesScope[];

/**
 * The two radios, widest first. `tick` is what the radio says; `ring` is
 * the set the dot and the glyph paint — the key itself.
 */
export const MAP_SEARCH_STOPS = [
  {
    key: "google",
    ring: "google",
    tick: "Google Places",
    label: "Google Places",
    hint: "Google Places, every Mesita Selected place included",
  },
  {
    key: "selected",
    ring: "selected",
    tick: "Mesita Selected",
    label: "Mesita Selected",
    hint: "Mesita Selected only",
  },
] as const satisfies readonly PlacesScopeStop<MapPlacesScope>[];

/** One radio on the Places control. */
export type PlacesScopeStop<K extends string> = {
  key: K;
  /** The set this stop paints, for the dot and the glyph. */
  ring: MapPlacesScope;
  tick: string;
  label: string;
  hint: string;
};

/**
 * Google review-count floor: 10+ · 100+ · 1,000+, default 100+ (MESITA-2298;
 * Pato set the minimum at 10+, MESITA-2336, so there is no 0+ stop). Mirror
 * `_shared/map-engine.ts`. A count of people, never stars; applied after
 * Google answers, and never to Mesita Selected.
 */
export const MAP_MIN_REVIEW_STOPS = [10, 100, 1000] as const;
export type MapMinReviews = (typeof MAP_MIN_REVIEW_STOPS)[number];
const MAP_MIN_REVIEWS_DEFAULT: MapMinReviews = 100;

export type MapFilters = {
  /** Google Places or Mesita Selected. Default is Mesita Selected. */
  placesScope: MapPlacesScope;
  /** Families: the fifteen guest families; empty = All Families. */
  familyKeys: FamilyKey[];
  /** Minimum Google reviews: 10, 100 or 1,000; the default is 100. */
  minReviews: MapMinReviews;
};

export const MAP_FILTER_DEFAULTS: MapFilters = {
  placesScope: MAP_PLACES_SCOPE_DEFAULT,
  familyKeys: [],
  minReviews: MAP_MIN_REVIEWS_DEFAULT,
};

export function clampMinReviews(value: unknown): MapMinReviews {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return MAP_MIN_REVIEWS_DEFAULT;
  // The lowest stop is the floor: a stored 0 (the retired 0+) lands on 10+.
  if (n <= MAP_MIN_REVIEW_STOPS[0]) return MAP_MIN_REVIEW_STOPS[0];
  let best: MapMinReviews = MAP_MIN_REVIEW_STOPS[MAP_MIN_REVIEW_STOPS.length - 1];
  let bestD = Number.POSITIVE_INFINITY;
  for (const stop of MAP_MIN_REVIEW_STOPS) {
    const d = Math.abs(stop - n);
    if (d < bestD || (d === bestD && stop > best)) {
      best = stop;
      bestD = d;
    }
  }
  return best;
}

/**
 * Absent and unknown values resolve to Mesita Selected. A persisted v6 blob
 * may still carry the retired words — `enriched` and `mesita` both land on
 * Mesita Selected (there is no Created-rows scope any more), `partners` on
 * the default — or an ordinal from before 2026-09-05, where 2 and up meant
 * Google and 1 and below the Mesita set.
 */
export function parsePlacesScope(value: unknown): MapPlacesScope {
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    if ((MAP_PLACES_SCOPES as readonly string[]).includes(key)) {
      return key as MapPlacesScope;
    }
    if (key === "enriched" || key === "mesita") return "selected";
    const legacy = Number(key);
    if (key.length > 0 && Number.isFinite(legacy)) {
      return legacy >= 2 ? "google" : "selected";
    }
    return MAP_PLACES_SCOPE_DEFAULT;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 2 ? "google" : "selected";
  }
  return MAP_PLACES_SCOPE_DEFAULT;
}

/**
 * The scope a row belongs to on this surface. A Google stub is Google's
 * alone; every Mesita row the server sends here is Mesita Selected. The
 * pin TONE still tells red from ink (`placePinTone`) — that is the colour's
 * promise, not the sheet's set.
 */
export function placeSearchScope(place: Place): MapPlacesScope {
  if (place.googleOnly || place.from_google) return "google";
  return "selected";
}

/**
 * Places each scope would show, from the catalog in hand. Cumulative — the
 * sets nest, so a Mesita row counts in both. Always selected ≤ google.
 */
export function placesScopeCounts(
  places: readonly Place[],
): Record<MapPlacesScope, number> {
  let selected = 0;
  for (const place of places) {
    if (placeSearchScope(place) === "selected") selected += 1;
  }
  return { selected, google: places.length };
}

export function mapFiltersAreActive(f: MapFilters): boolean {
  return mapFilterCount(f) > 0;
}

/** Leaving the default scope, each Family, or leaving the default Google
 *  Reviews stop, counts as one. */
export function mapFilterCount(f: MapFilters): number {
  const scope = f.placesScope === MAP_PLACES_SCOPE_DEFAULT ? 0 : 1;
  const reviews = f.minReviews === MAP_MIN_REVIEWS_DEFAULT ? 0 : 1;
  return scope + f.familyKeys.length + reviews;
}
