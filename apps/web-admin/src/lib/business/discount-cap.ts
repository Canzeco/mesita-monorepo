// The per-place discount cap for Visits Rewards. The ladder is MX$200 / MX$500 /
// MX$1000; Zero clears the cap and leaving Zero seeds the default. promos.ts
// snaps every stored cap through snapDiscountCap. Mirrors
// supabase/functions/_shared/discount-cap.ts, which is authoritative.

/** Legal per-place discount caps (MXN). Zero strategy clears the cap. */
export const DISCOUNT_CAPS_MXN = [200, 500, 1000] as const;
export type DiscountCapMxn = (typeof DISCOUNT_CAPS_MXN)[number];

/** Default when a place leaves Zero or has no cap yet. */
export const DEFAULT_DISCOUNT_CAP_MXN: DiscountCapMxn = 500;

/** Snap any number onto the legal discount-cap ladder (nearest option). */
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
