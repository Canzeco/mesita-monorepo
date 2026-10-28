// Place family law. The guest catalog is thirty-seven families
// (catalog-families.ts); Undefined is last and is not a rail. A place's
// families are its stored list (MESITA-2891), read here as the keys already
// on the row, or through a dictionary passed in. The Atlas category twin that
// mapped retired Mesita categories to families is gone (MESITA-2974): the
// category gate is the Google type map alone (map-engine.ts).

import { CATALOG_FAMILIES, type FamilyKey } from "./catalog-families.ts";

export type { FamilyKey };

export const FAMILIES = CATALOG_FAMILIES;

const FAMILY_SLUGS = new Set<string>(FAMILIES.map((s) => s.slug));
const FAMILY_ORDER = new Map<FamilyKey, number>(
  FAMILIES.map((s) => [s.slug, s.sort_order]),
);

export function isFamilyKey(value: string): value is FamilyKey {
  return FAMILY_SLUGS.has(value);
}

/**
 * Unique valid families, catalog order, any count. A category may sit in
 * many families. `undefined` never rides along with a real family.
 */
export function sanitizeFamilyKeys(raw: unknown): FamilyKey[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<FamilyKey>();
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const slug = v.trim().toLowerCase();
    if (isFamilyKey(slug)) seen.add(slug);
  }
  if (seen.size > 1) seen.delete("undefined");
  return [...seen].sort(
    (a, b) => (FAMILY_ORDER.get(a) ?? 99) - (FAMILY_ORDER.get(b) ?? 99),
  );
}

/**
 * Guest family pills: unique catalog slugs, any count (OR). Not place
 * membership — a guest may select Restaurants and Wellness together.
 */
export function readGuestFamilyKeys(raw: unknown): FamilyKey[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<FamilyKey>();
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const slug = v.trim().toLowerCase();
    if (isFamilyKey(slug)) seen.add(slug);
  }
  return [...seen].sort(
    (a, b) => (FAMILY_ORDER.get(a) ?? 99) - (FAMILY_ORDER.get(b) ?? 99),
  );
}

export type FamilyPlace = {
  category?: string | null;
  family_keys?: unknown;
};

export type CategoryFamilyMap = Readonly<Record<string, readonly string[]>>;

/**
 * Families for a place. TOTAL.
 * A dictionary is the mutable Category ↔ Family mapping and wins outright,
 * so a mapping change reorganizes the catalog without a profile write.
 * With no dictionary, the keys already on the row are the view's derived
 * membership. An empty row is Undefined. The code twin is not consulted.
 */
export function familiesForPlace(
  place: FamilyPlace,
  mapping?: CategoryFamilyMap,
): FamilyKey[] {
  if (mapping) {
    const category = typeof place.category === "string"
      ? place.category.trim().toLowerCase()
      : "";
    const fromMap = category ? sanitizeFamilyKeys(mapping[category]) : [];
    return fromMap.length > 0 ? fromMap : ["undefined"];
  }
  const carried = sanitizeFamilyKeys(place.family_keys);
  if (carried.length > 0) return carried;
  return ["undefined"];
}
