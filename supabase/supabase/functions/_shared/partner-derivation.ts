// Mesita Partner / promo-lane derivation (MESITA-912).
//
// listing_type = 'partner' iff plan is Ultra AND strategy ≠ zero (MESITA-2020).
// Pro pays but does not wear the guest-facing badge until rewards are live.
// Otherwise demote partner → web; leave unclaimed untouched.
//
// Also holds the membership stamp resets every plan write shares: the two
// plan doors (admin-web-set-plan, business-web-set-partnership), the
// Membership cascade (place-partnership.ts) and strike 3
// (membership-strike-patch.ts).

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
    params.plan === "ultra" && strategy !== null && strategy !== "zero";

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

/** Null the activation stamps so the next join starts pending again. */
export function clearActivationStamps(patch: Record<string, unknown>): void {
  patch.plan_live_at = null;
  patch.first_ticket_honored_at = null;
}

/** Re-joining after a forfeit wipes the forfeit and strike state, then
 *  restarts pending activation. */
export function clearForfeitStamps(patch: Record<string, unknown>): void {
  patch.plan_forfeited_at = null;
  patch.strike_count = 0;
  patch.promo_paused_until = null;
  clearActivationStamps(patch);
}
