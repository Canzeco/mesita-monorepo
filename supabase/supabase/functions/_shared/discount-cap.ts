// Per-place discount cap (Promos, 2026-08-09).
//
// Cap is independent of strategy: a member picks Zero / Conservative /
// Aggressive AND separately picks MX$200 / 500 / 1000. Persisted on
// projects.monthly_promo_cap. Billing prefers the place cap; the platform
// promos_config.cap is the fallback when a paid place has a null cap
// (legacy / mid-migration).

export const DISCOUNT_CAPS_MXN = [200, 500, 1000] as const;
export type DiscountCapMxn = (typeof DISCOUNT_CAPS_MXN)[number];
export const DEFAULT_DISCOUNT_CAP_MXN: DiscountCapMxn = 500;

/** Snap onto the legal ladder (nearest option). */
export function snapDiscountCap(v: unknown): DiscountCapMxn {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    return DEFAULT_DISCOUNT_CAP_MXN;
  }
  let best: DiscountCapMxn = DISCOUNT_CAPS_MXN[0];
  for (const option of DISCOUNT_CAPS_MXN) {
    if (Math.abs(option - v) < Math.abs(best - v)) best = option;
  }
  return best;
}

/**
 * Cap used for ticket bill math. Place wins when set; otherwise platform
 * fallback (promos_config.cap), then the product default.
 */
export function resolveBillCapPesos(
  place: { monthly_promo_cap?: number | null } | Record<string, unknown>,
  platformCap: number | null | undefined,
): number {
  const raw = (place as { monthly_promo_cap?: unknown }).monthly_promo_cap;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return snapDiscountCap(raw);
  }
  if (typeof platformCap === "number" && Number.isFinite(platformCap) && platformCap > 0) {
    return snapDiscountCap(platformCap);
  }
  return DEFAULT_DISCOUNT_CAP_MXN;
}
