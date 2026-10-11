// The consumer wire mapper: everything computed onto a place row on its way
// out to a guest.
//
// Adds `family_keys` (MESITA-679) — source of truth is
// `_shared/place-taxonomy.ts` (Atlas membership = the FULL 1–2 super set
// when the category is in the catalog; stored keys only when membership
// is empty; else the Google primaryType map; else ['undefined'] — the
// resolution is total). A category in two supers ships both keys.
// Clients must not re-mirror that expansion; Search map Filters cut on
// Family off this field.
//
// Adds `enriched` — whether Mesita wrote a profile for this place (below).
// Every consumer place payload runs through here, so this is the one place
// both facts are stated.

import { familiesForPlace, type FamilyKey } from "./place-taxonomy.ts";

export type PlaceCategoryRow = {
  category?: string | null;
  family_keys?: unknown;
  content_state?: string | null;
  enriched_at?: string | null;
};

/** What a consumer place row gains on the wire. */
export type WireExtras = {
  family_keys: FamilyKey[];
  enriched: boolean;
};

/**
 * Did we do the work on this place? `content_state = 'ready'` OR a stamped
 * `enriched_at` — BOTH, never one. 27% of the live catalog is ready with a
 * null `enriched_at` (measured 2026-08-29), so an `enriched_at`-only test
 * would grey a quarter of the catalog on deploy.
 *
 * This is the SERVER's answer. Membership colour is stated here and never
 * re-derived by a client (Pato, 2026-08-29): three clients each deriving the
 * same fact is how red drifted from "we wrote a profile" to "we have a row".
 */
export function isEnrichedPlace(
  row: { content_state?: string | null; enriched_at?: string | null } | null,
): boolean {
  if (!row) return false;
  return row.content_state === "ready" || Boolean(row.enriched_at);
}

/** The row as a guest receives it. */
export type WirePlace<T> = T & WireExtras;

/**
 * Wire mapper: set `family_keys` from Atlas membership / stored / Google type,
 * and `enriched` from the two enrichment columns. Both are always overwritten
 * so a stale client cache can't leak a previous value.
 */
export function withFamilyKeys<T extends PlaceCategoryRow>(
  row: T,
): WirePlace<T> {
  return {
    ...row,
    family_keys: familiesForPlace(row),
    enriched: isEnrichedPlace(row),
  };
}

/** Map a list of place rows through {@link withFamilyKeys}. */
export function withFamilyKeysList<T extends PlaceCategoryRow>(
  rows: T[],
): Array<WirePlace<T>> {
  return rows.map(withFamilyKeys);
}
