// The four per-class promo rate columns and their legal value set.
//
// Lives in _shared because two EFs now validate them: business-web-update-
// project (the profile door) and admin-web-set-plan (the membership door,
// which takes rates alongside the plan so a paid membership and the strategy
// that justifies it land in ONE write — see MESITA-818).

export const PROMO_RATE_FIELDS = [
  "welcome_free_rate",
  "welcome_premium_rate",
  "free_rate",
  "premium_rate",
] as const;

type PromoRateField = (typeof PROMO_RATE_FIELDS)[number];

const LEGAL_PROMO_RATES = new Set([10, 20, 30, 40, 50]);

export function normalisePromoRate(
  field: PromoRateField,
  raw: unknown,
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (raw == null) return { ok: true, value: null };
  const v = Number(raw);
  if (!LEGAL_PROMO_RATES.has(v)) {
    return {
      ok: false,
      error: `${field} must be null or one of 10, 20, 30, 40, 50`,
    };
  }
  return { ok: true, value: v };
}
