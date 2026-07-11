// Subset of web lib/promo-rates.ts — enough for the swipe reward chip.

function positiveRate(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null;
  return v;
}

/** Resolve welcome/return rate for free class from a place row (mobile has no class context yet — free). */
export function resolvePromoRateFromPlaceRow(
  row: Record<string, unknown>,
  isFirstVisit: boolean,
  isPremium = false,
): number | null {
  const welcome = isPremium
    ? positiveRate(row.welcome_premium_rate)
    : positiveRate(row.welcome_free_rate);
  const returning = isPremium
    ? positiveRate(row.premium_rate)
    : positiveRate(row.free_rate);
  return (isFirstVisit ? (welcome ?? returning) : (returning ?? welcome)) ?? null;
}
