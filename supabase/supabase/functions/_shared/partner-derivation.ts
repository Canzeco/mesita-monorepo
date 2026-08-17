// Mesita Partner / promo-lane derivation (MESITA-912).
//
// listing_type = 'partner' iff membership (plan ≠ free) AND strategy ≠ zero.
// Otherwise demote partner → web; leave unclaimed untouched.

import {
  type PromoRates,
  ratesFromPlace,
  strategyForRates,
} from "./promo-strategy.ts";

export type ListingType = "partner" | "web" | "unclaimed";

export function deriveListingType(params: {
  plan: string;
  rates: PromoRates;
  currentListingType: string | null | undefined;
}): ListingType | undefined {
  const strategy = strategyForRates(params.rates);
  const shouldBePartner =
    params.plan !== "free" && strategy !== null && strategy !== "zero";

  if (shouldBePartner) return "partner";

  if (params.currentListingType === "partner") return "web";

  // unclaimed and web stay as-is — caller skips listing_type in the patch.
  return undefined;
}

/** Merge derived listing_type into a projects patch when it changes. */
export function applyListingTypeToPatch(
  patch: Record<string, unknown>,
  params: {
    plan: string;
    rates: PromoRates;
    currentListingType: string | null | undefined;
  },
): void {
  const next = deriveListingType(params);
  if (next !== undefined && next !== params.currentListingType) {
    patch.listing_type = next;
  }
}

export function effectiveRatesAfterPatch(
  row: Record<string, unknown>,
  patch: Record<string, unknown>,
): PromoRates {
  const merged = { ...row };
  for (const field of [
    "welcome_free_rate",
    "welcome_premium_rate",
    "free_rate",
    "premium_rate",
  ] as const) {
    if (field in patch) merged[field] = patch[field];
  }
  return ratesFromPlace(merged);
}
