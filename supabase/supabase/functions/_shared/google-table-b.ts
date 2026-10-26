// Google's Table B place types: generic markers Google returns beside the
// real types (point_of_interest, establishment, food, the address parts).
// They name no kind of place and cannot be searched, so Mesita never stores
// them (Pato, MESITA-2785: "what the fuck does that even mean?"). The write
// door drops them from google_types.
// https://developers.google.com/maps/documentation/places/web-service/place-types

export const GOOGLE_TABLE_B_TYPES: ReadonlySet<string> = new Set([
  "administrative_area_level_3",
  "administrative_area_level_4",
  "administrative_area_level_5",
  "administrative_area_level_6",
  "administrative_area_level_7",
  "archipelago",
  "colloquial_area",
  "continent",
  "establishment",
  "finance",
  "food",
  "general_contractor",
  "geocode",
  "health",
  "intersection",
  "landmark",
  "natural_feature",
  "neighborhood",
  "place_of_worship",
  "plus_code",
  "point_of_interest",
  "political",
  "postal_code_prefix",
  "postal_code_suffix",
  "postal_town",
  "premise",
  "route",
  "street_address",
  "sublocality",
  "sublocality_level_1",
  "sublocality_level_2",
  "sublocality_level_3",
  "sublocality_level_4",
  "sublocality_level_5",
  "subpremise",
  "town_square",
]);

/** google_types without Table B; anything that is not a list passes through. */
export function withoutTableB(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.filter((t) => !(typeof t === "string" && GOOGLE_TABLE_B_TYPES.has(t)));
}

/** google_types cleaned for storage: strings only, deduped, no Table B. */
export function cleanGoogleTypes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const raw of value) {
    const t = typeof raw === "string" ? raw.trim() : "";
    if (t && !GOOGLE_TABLE_B_TYPES.has(t) && !out.includes(t)) out.push(t);
  }
  return out;
}

/**
 * google_types as stored: Google's primary type first, then the rest in
 * Google's order, deduped, no Table B. The list is the Google categories
 * field; its first item is the primary category shown wherever one is
 * (Pato, MESITA-2790). A Table B primary is dropped like any other, so the
 * first Table A type leads.
 */
export function googleTypesPrimaryFirst(
  primaryType: string | null | undefined,
  types: unknown,
): string[] {
  const primary = typeof primaryType === "string" ? primaryType.trim() : "";
  return cleanGoogleTypes(primary ? [primary, ...(Array.isArray(types) ? types : [])] : types);
}
