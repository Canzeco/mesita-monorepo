// The consumer wire mapper: everything computed onto a place row on its way
// out to a guest, and everything dropped from it.
//
// Adds `family_keys` (MESITA-679) — source of truth is `_shared/sourcing.ts`
// FAMILY_GOOGLE_TYPES; clients must not re-mirror that expansion, discovery
// filters read the field off the wire.
//
// Adds `promoting` (MESITA-1150) — whether a guest gets a discount here RIGHT
// NOW, computed rather than read off the stale `listing_type` enum. See
// place-promoting.ts for why those are different questions.
//
// Drops the business-private columns the server selected to answer that
// question: a guest has no use for a restaurant's plan and no business
// knowing its strike record. Every consumer place payload runs through here,
// so this is the one place both rules have to hold.

import { familiesForGoogleType, type FamilyKey } from "./sourcing.ts";
import {
  BUSINESS_PRIVATE_PLACE_KEYS,
  isPlacePromoting,
  type PromotingFields,
} from "./place-promoting.ts";

export type PlaceCategoryRow = {
  category?: string | null;
} & PromotingFields;

/** What a consumer place row gains on the wire. */
export type WireExtras = { family_keys: FamilyKey[]; promoting: boolean };

/** What it loses. */
export type WirePlace<T> = Omit<T, (typeof BUSINESS_PRIVATE_PLACE_KEYS)[number]> &
  WireExtras;

/**
 * Wire mapper: set `family_keys` from `category` (Google primaryType-style)
 * and `promoting` from the rate/plan/lane columns, then drop those columns.
 * Both are always overwritten so a stale client cache can't leak a previous
 * value — and `promoting` in particular must never be readable as anything
 * but this run's answer.
 */
export function withFamilyKeys<T extends PlaceCategoryRow>(
  row: T,
): WirePlace<T> {
  const promoting = isPlacePromoting(row);
  const out = {
    ...row,
    family_keys: familiesForGoogleType(row.category),
    promoting,
  } as Record<string, unknown>;
  for (const key of BUSINESS_PRIVATE_PLACE_KEYS) delete out[key];
  return out as WirePlace<T>;
}

/** Map a list of place rows through {@link withFamilyKeys}. */
export function withFamilyKeysList<T extends PlaceCategoryRow>(
  rows: T[],
): Array<WirePlace<T>> {
  return rows.map(withFamilyKeys);
}
