// Attach computed `family_keys` on consumer place payloads (MESITA-679).
//
// Source of truth: `_shared/sourcing.ts` FAMILY_GOOGLE_TYPES reverse map.
// Clients must not re-mirror that expansion — discovery filters read this
// field from the wire.

import { familiesForGoogleType, type FamilyKey } from "./sourcing.ts";

export type PlaceCategoryRow = {
  category?: string | null;
};

/**
 * Wire mapper: set `family_keys` from `category` (Google primaryType-style).
 * Always overwrites so stale client caches can't leak a previous value.
 */
export function withFamilyKeys<T extends PlaceCategoryRow>(
  row: T,
): T & { family_keys: FamilyKey[] } {
  return {
    ...row,
    family_keys: familiesForGoogleType(row.category),
  };
}

/** Map a list of place rows through {@link withFamilyKeys}. */
export function withFamilyKeysList<T extends PlaceCategoryRow>(
  rows: T[],
): Array<T & { family_keys: FamilyKey[] }> {
  return rows.map(withFamilyKeys);
}
