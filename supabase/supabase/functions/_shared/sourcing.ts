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

/** Google's cap on `excludedPrimaryTypes` in one Nearby request. */
const NEARBY_EXCLUDED_CAP = 50;

/**
 * The Family gate pushed down EXACTLY (MESITA-2338). A family's Nearby
 * battery can be a general type (Dinner sends `restaurant`), and Google then
 * returns its precise subtypes too (`mexican_restaurant`, `pizza_restaurant`)
 * — types that belong to another family, which the gate would throw away
 * after the one billed call. This lists every Table A type in the same coarse
 * group as an included type that maps to none of the requested families, for
 * Nearby's `excludedPrimaryTypes`. Empty when no family is requested.
 */
export function nearbyExcludedTypesForFamilies(
  includedTypes: readonly string[],
  families: readonly string[],
): string[] {
  if (families.length === 0 || includedTypes.length === 0) return [];
  const included = new Set(includedTypes);
  const groups = new Set(
    includedTypes.map((t) => GOOGLE_TYPE_SUPER[t] ?? superForGoogleType(t)).filter(
      (g): g is NonNullable<typeof g> => Boolean(g) && g !== "undefined",
    ),
  );
  const out: string[] = [];
  for (const [type, group] of Object.entries(GOOGLE_TYPE_SUPER)) {
    if (!groups.has(group) || included.has(type)) continue;
    const fams = familiesForGoogleType(type);
    if (fams.some((f) => families.includes(f))) continue;
    out.push(type);
  }
  return out.sort().slice(0, NEARBY_EXCLUDED_CAP);
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
