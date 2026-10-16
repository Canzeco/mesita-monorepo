// Google type → Family. Search and Add eligibility is Discovery ›
// Map (`evaluatePlaceForMap`). The exclusive 478-type Google map lives in
// google-type-super.ts — this file re-exports FamilyKey and maps a type
// onto zero or one guest family. A type whose family is `undefined` returns
// nothing here: Undefined is a family, and it is not a guest pill, so
// hotels, schools, and shops stay ineligible. The CATEGORY side is
// multi-parent (≤2) in place-taxonomy.ts; the Google side stays exclusive.

import { familiesForCatalogSlug, type FamilyKey } from "./catalog-families.ts";
import { GOOGLE_TYPE_SUPER, superForGoogleType } from "./google-type-super.ts";

export type { FamilyKey };

/**
 * Guest families for a Google type. Empty when the type is unknown.
 * Undefined is a family and not a guest pill, so hotels and shops
 * return nothing here.
 */
export function familiesForGoogleType(
  primaryType: string | null | undefined,
): FamilyKey[] {
  if (!primaryType) return [];
  const slug = primaryType.trim().toLowerCase();
  if (!slug) return [];
  const coarse = GOOGLE_TYPE_SUPER[slug] ?? superForGoogleType(slug);
  const families = familiesForCatalogSlug(slug, coarse);
  return families.filter((key) => key !== "undefined");
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
