// The consumer wire mapper: everything computed onto a place row on its way
// out to a guest, and everything dropped from it.
//
// Adds `family_keys` (MESITA-679) — source of truth is
// `_shared/place-taxonomy.ts` (Atlas membership = the full Super Category
// set when the category is in the catalog; stored keys only when
// membership is empty; else the Google primaryType map). A category in
// two supers ships both keys. Clients must not re-mirror that expansion;
// Search map Filters cut on Super Category off this field.
//
// Adds `promoting` (MESITA-1150) — whether a guest gets a discount here RIGHT
// NOW, computed rather than read off the stale `listing_type` enum. See
// place-promoting.ts for why those are different questions.
//
// Adds `partner` — whether the place PAYS Mesita, computed the same way for
// the same reason. `listing_type` fuses "pays" with "strategy above zero" into
// one stored enum and is only rewritten when something writes the place, so a
// strike-2 pause leaves it standing; reading partner off it would resurrect
// exactly the staleness MESITA-1150 removed. This is the plan and nothing
// else, so the three place facts stay independent: Verified (ownership),
// Partner (pays), Promoting (a live discount).
//
// Drops the business-private columns the server selected to answer that
// question: a guest has no use for a restaurant's plan and no business
// knowing its strike record. Every consumer place payload runs through here,
// so this is the one place both rules have to hold.

import { familiesForPlace, type FamilyKey } from "./place-taxonomy.ts";
import {
  BUSINESS_PRIVATE_PLACE_KEYS,
  isPlacePromoting,
  type PromotingFields,
} from "./place-promoting.ts";
import { isPaidPlan } from "./membership-enforcement-helpers.ts";

export type PlaceCategoryRow = {
  category?: string | null;
  family_keys?: unknown;
} & PromotingFields;

/** What a consumer place row gains on the wire. */
export type WireExtras = {
  family_keys: FamilyKey[];
  promoting: boolean;
  partner: boolean;
};

/** What it loses. */
export type WirePlace<T> = Omit<T, (typeof BUSINESS_PRIVATE_PLACE_KEYS)[number]> &
  WireExtras;

/**
 * Wire mapper: set `family_keys` from Atlas membership / stored / Google type,
 * and `promoting` + `partner` from the rate/plan/lane columns, then drop those
 * columns.
 * Both are always overwritten so a stale client cache can't leak a previous
 * value — and `promoting` in particular must never be readable as anything
 * but this run's answer.
 */
export function withFamilyKeys<T extends PlaceCategoryRow>(
  row: T,
): WirePlace<T> {
  const promoting = isPlacePromoting(row);
  // Computed from `plan` BEFORE the business-private keys are dropped below —
  // the guest never receives the plan itself, only this boolean.
  const partner = isPaidPlan(row.plan);
  const out = {
    ...row,
    family_keys: familiesForPlace(row),
    promoting,
    partner,
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
