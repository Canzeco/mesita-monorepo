// Google type → Family. Search and Add eligibility is Discovery ›
// Map (`evaluatePlaceForMap`). The exclusive 478-type Google map lives in
// google-type-super.ts — this file re-exports FamilyKey and maps a type
// onto zero or one guest family. A type whose family is `undefined` returns
// nothing here: Undefined is a family, and it is not a guest pill, so
// hotels, schools, and shops stay ineligible. The CATEGORY side is
// multi-parent (≤2) in place-taxonomy.ts; the Google side stays exclusive.

import {
  familiesForCatalogSlug,
  familiesPrimaryFirst,
  type FamilyKey,
} from "./catalog-families.ts";
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

/** One Google type's guest families, PRIMARY FIRST (MESITA-2438). */
function guestFamiliesPrimaryFirst(type: string | null | undefined): FamilyKey[] {
  const slug = (type ?? "").trim().toLowerCase();
  if (!slug) return [];
  const coarse = GOOGLE_TYPE_SUPER[slug] ?? superForGoogleType(slug);
  return familiesPrimaryFirst(slug, coarse).filter((key) => key !== "undefined");
}

/** The primary family of a Google `primaryType`; null when it has none. */
export function primaryFamilyForGoogleType(
  primaryType: string | null | undefined,
): FamilyKey | null {
  return guestFamiliesPrimaryFirst(primaryType)[0] ?? null;
}

/** Google's umbrella type: every cuisine carries it in `types[]`, so it
 *  would make every restaurant a secondary Dinner. */
const SECONDARY_IGNORED = new Set(["restaurant"]);
/** At most this many secondary families per place. */
export const SECONDARY_FAMILIES_MAX = 2;

/**
 * A place's families from Google (MESITA-2438): exactly one PRIMARY, from
 * its `primaryType`, and 0–2 SECONDARY — the primary type's other
 * families, then the primary families of its other `types[]`, in Google's
 * order. A primary type in no family means no families at all: the place
 * is not a Mesita place, whatever else it is typed.
 */
export function placeFamilies(
  primaryType: string | null | undefined,
  types: readonly string[] | null | undefined = [],
): { primary: FamilyKey | null; secondary: FamilyKey[]; keys: FamilyKey[] } {
  const own = guestFamiliesPrimaryFirst(primaryType);
  const primary = own[0] ?? null;
  if (!primary) return { primary: null, secondary: [], keys: [] };
  const secondary: FamilyKey[] = [];
  const add = (f: FamilyKey | undefined) => {
    if (!f || f === primary || secondary.includes(f)) return;
    if (secondary.length < SECONDARY_FAMILIES_MAX) secondary.push(f);
  };
  for (const f of own.slice(1)) add(f);
  for (const t of types ?? []) {
    if (SECONDARY_IGNORED.has(t) || t === primaryType) continue;
    add(guestFamiliesPrimaryFirst(t)[0]);
  }
  return { primary, secondary, keys: [primary, ...secondary] };
}

/** Google's cap on `excludedPrimaryTypes` in one Nearby request. */
const NEARBY_EXCLUDED_CAP = 50;

/** Battery types Google treats as general parents: asked for, Nearby also
 *  returns their more specific subtypes. Only these need exclusions; a
 *  precise type (`pizza_restaurant`) brings back nothing else. */
const NEARBY_GENERAL_PARENTS = new Set([
  "restaurant",
  "cafe",
  "bar",
  "bakery",
  "night_club",
]);

/**
 * The Family gate pushed down (MESITA-2338). A family's Nearby battery can
 * be a general parent type (Dinner sends `restaurant`), and Google then
 * returns its precise subtypes too (`mexican_restaurant`, `pizza_restaurant`)
 * — types the gate throws away after the one billed call, leaving a thin
 * answer. For each included general parent this lists the Table A types in
 * its coarse group (and, for `restaurant`, every `*_restaurant`) that map to
 * none of the requested families, for Nearby's `excludedPrimaryTypes`.
 * No family requested means every guest family (MESITA-2382): the subtypes
 * that sit in no family (churches, hotels, shops, attractions) are
 * excluded so "All" is not spent on places the gate throws away.
 * Empty when no general parent is included.
 *
 * Known edge, accepted: a Mesita-owned place whose Mesita family differs
 * from its Google type's family (filed under Dinner, typed
 * `mexican_restaurant`) is not returned under Dinner in the Google Places
 * scope; it still shows under Dinner in Mesita Selected. Today every live
 * category is the Google type, so the two agree.
 */
export function nearbyExcludedTypesForFamilies(
  includedTypes: readonly string[],
  families: readonly string[],
): string[] {
  if (includedTypes.length === 0) return [];
  const included = new Set(includedTypes);
  const parents = includedTypes.filter((t) => NEARBY_GENERAL_PARENTS.has(t));
  if (parents.length === 0) return [];
  const groups = new Set(
    parents.map((t) => GOOGLE_TYPE_SUPER[t] ?? superForGoogleType(t)).filter(
      (g): g is NonNullable<typeof g> => Boolean(g) && g !== "undefined",
    ),
  );
  const restaurantParent = parents.includes("restaurant");
  const out: string[] = [];
  for (const [type, group] of Object.entries(GOOGLE_TYPE_SUPER)) {
    const subtype = groups.has(group) || (restaurantParent && type.endsWith("_restaurant"));
    if (!subtype || included.has(type)) continue;
    const fams = familiesForGoogleType(type);
    const kept = families.length === 0 ? fams.length > 0 : fams.some((f) => families.includes(f));
    if (kept) continue;
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
