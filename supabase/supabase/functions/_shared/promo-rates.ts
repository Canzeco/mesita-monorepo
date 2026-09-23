// The four per-class promo rate columns, `monthly_promo_cap`, and their legal
// value sets.
//
// Lives in _shared because three EFs validate them, and they validate through
// ONE function so their 400s cannot drift: business-web-update-place (the
// profile door), admin-web-set-plan (the super-admin membership door) and
// business-web-set-partnership (the operator's door). The two plan doors take
// rates alongside the plan so a paid membership and the strategy that
// justifies it land in ONE write — see MESITA-818.

import { DISCOUNT_CAPS_MXN } from "./discount-cap.ts";
import { json } from "./http.ts";

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

/** True when the body carries any promo rate key or `monthly_promo_cap`. */
export function hasPromoRatesInBody(body: Record<string, unknown>): boolean {
  return PROMO_RATE_FIELDS.some((f) => f in body) || "monthly_promo_cap" in body;
}

/**
 * Copy every promo rate and `monthly_promo_cap` present in `body` onto
 * `patch`, validated. Absent keys are left alone; null clears. The first
 * illegal value returns the 400 the EF sends as-is. The cap ladder is
 * DISCOUNT_CAPS_MXN; the places CHECK constraints mirror both sets.
 */
export function applyPromoRatesFromBody(
  body: Record<string, unknown>,
  patch: Record<string, unknown>,
): { ok: true } | { ok: false; response: Response } {
  for (const field of PROMO_RATE_FIELDS) {
    if (!(field in body)) continue;
    const rate = normalisePromoRate(field, body[field]);
    if (!rate.ok) return { ok: false, response: json({ ok: false, error: rate.error }, 400) };
    patch[field] = rate.value;
  }
  if ("monthly_promo_cap" in body) {
    const raw = body.monthly_promo_cap;
    if (raw == null) {
      patch.monthly_promo_cap = null;
    } else if (!(DISCOUNT_CAPS_MXN as readonly number[]).includes(Number(raw))) {
      return {
        ok: false,
        response: json(
          {
            ok: false,
            error: `monthly_promo_cap must be null or one of ${DISCOUNT_CAPS_MXN.join(", ")}`,
          },
          400,
        ),
      };
    } else {
      patch.monthly_promo_cap = Number(raw);
    }
  }
  return { ok: true };
}
