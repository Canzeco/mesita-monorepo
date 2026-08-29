// Google type → Super Category. Search and Add eligibility is Discovery ›
// Map (`evaluatePlaceForMap`). The exclusive 478-type partition lives in
// google-type-super.ts — this file re-exports FamilyKey and maps a type
// onto zero or one guest Super (`other` → ineligible). Atlas slugs live
// in place-taxonomy.ts. Hotels, schools, shops are `other`.

import { superForGoogleType, type GuestSuper } from "./google-type-super.ts";

export type FamilyKey = GuestSuper;

/**
 * The one guest Super a Google type (or leftover places.category slug)
 * belongs to. Empty = `other` / unknown — not a Mesita type. Partition:
 * gastropub is restaurants only.
 */
export function familiesForGoogleType(
  primaryType: string | null | undefined,
): FamilyKey[] {
  const superKey = superForGoogleType(primaryType);
  if (!superKey || superKey === "other") return [];
  return [superKey];
}

/** The primary (catalog-order first) family a Google type belongs to. */
export function familyForGoogleType(primaryType: string | null | undefined): FamilyKey | null {
  return familiesForGoogleType(primaryType)[0] ?? null;
}

type GeoOrigin = { lat: number; lng: number };

/** CLDR / ISO-3166-1 alpha-2. Empty = omit Google's optional country params. */
export function parseCldrRegionCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const c = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : "";
}

/**
 * Places (New): `regionCode` is optional (format + soft bias; Text Search has
 * no country restrict). Autocomplete may also send `includedRegionCodes` (hard
 * list; empty = no restrict). Callers pass this from the name searchbar.
 */
export function applyPlacesCallerRegion(
  body: Record<string, unknown>,
  raw: unknown,
  kind: "autocomplete" | "text",
): void {
  const code = parseCldrRegionCode(raw);
  if (!code) return;
  body.regionCode = code;
  if (kind === "autocomplete") body.includedRegionCodes = [code];
}

function circleAround(center: GeoOrigin, radiusKm: number) {
  return {
    circle: {
      center: { latitude: center.lat, longitude: center.lng },
      radius: Math.min(50_000, Math.max(1, radiusKm * 1000)),
    },
  };
}

function applyGuestLocationBias(
  body: Record<string, unknown>,
  origin?: GeoOrigin | null,
): void {
  if (!origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) {
    return;
  }
  body.locationBias = circleAround(
    { lat: origin.lat, lng: origin.lng },
    8,
  );
}

/** Autocomplete (New): guest pin bias only. */
export function applyPlacesAutocompleteRegion(
  body: Record<string, unknown>,
  origin?: GeoOrigin | null,
): void {
  applyGuestLocationBias(body, origin);
}

/** Text Search (New): guest pin bias only. */
export function applyPlacesTextSearchRegion(
  body: Record<string, unknown>,
  origin?: GeoOrigin | null,
): void {
  applyGuestLocationBias(body, origin);
}

export type EligibilityResult =
  | { eligible: true }
  | { eligible: false; code: string; reason: string };
