import type { ConsumerClass } from "@/lib/mock/place";

// Per-class promo rates. The `free`/`premium` keys mirror the v4 places
// columns (welcome_free_rate / free_rate / …) — the DB column vocabulary is
// unchanged (the v5 standard/magnetic columns are a not-yet-landed backend
// follow-up, MESITA-723). The consumer class → column mapping lives in
// resolveActivePromoRate: Standard reads `free`; Premium and Magnetic read
// `premium`.
type PromoClassRates = {
  free: number | null;
  premium: number | null;
};

type PromoMatrix = {
  welcome: PromoClassRates;
  default: PromoClassRates;
  is_first_visit: boolean;
};

function positiveRate(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
  return v;
}

export function hasExplicitClassRates(row: Record<string, unknown>): boolean {
  return (
    positiveRate(row.welcome_free_rate) != null ||
    positiveRate(row.welcome_premium_rate) != null ||
    positiveRate(row.free_rate) != null ||
    positiveRate(row.premium_rate) != null
  );
}

/** Map places row → promo matrix from the per-class rate columns. */
export function buildPromoMatrixFromRow(
  row: Record<string, unknown>,
  _listingType: "partner" | "web",
): PromoMatrix {
  const welcome = {
    free: positiveRate(row.welcome_free_rate),
    premium: positiveRate(row.welcome_premium_rate),
  };
  const defaults = {
    free: positiveRate(row.free_rate),
    premium: positiveRate(row.premium_rate),
  };

  return {
    welcome,
    default: defaults,
    is_first_visit: row.is_first_visit !== false,
  };
}

function promoMatrixHasAnyRate(matrix: PromoMatrix): boolean {
  return (
    matrix.welcome.free != null ||
    matrix.welcome.premium != null ||
    matrix.default.free != null ||
    matrix.default.premium != null
  );
}

export function resolveActivePromoRate(
  matrix: PromoMatrix,
  classKey: ConsumerClass,
  isFirstVisit = matrix.is_first_visit,
): number | null {
  // Standard reads the `free` column; Premium and Magnetic both read `premium`
  // (Magnetic has no dedicated v4 column, and ranks at or above Premium).
  const col: keyof PromoClassRates = classKey === "standard" ? "free" : "premium";
  const welcome = matrix.welcome[col];
  const returning = matrix.default[col];
  return (
    (isFirstVisit ? (welcome ?? returning) : (returning ?? welcome)) ?? null
  );
}

/** Whether the place runs the Mesita reward program (detail hero + matrix). */
export function placeOffersMesitaRewards(input: {
  listing_type: "partner" | "web";
  promo_matrix: PromoMatrix;
  promo_configured: boolean;
}): boolean {
  if (!promoMatrixHasAnyRate(input.promo_matrix)) return false;
  if (input.listing_type === "partner") return true;
  // Business configured per-tier rates on the Promos page — active even if
  // listing_type is still 'web' pending the Verified Partner badge.
  return input.promo_configured;
}

export function resolvePromoRateFromPlaceRow(
  row: Record<string, unknown>,
  isFirstVisit: boolean,
  premium: boolean,
): number | null {
  const listingType = row.listing_type === "partner" ? "partner" : "web";
  const matrix = buildPromoMatrixFromRow(row, listingType);
  if (
    !placeOffersMesitaRewards({
      listing_type: listingType,
      promo_matrix: matrix,
      promo_configured: hasExplicitClassRates(row),
    })
  ) {
    return null;
  }
  return resolveActivePromoRate(
    matrix,
    premium ? "premium" : "standard",
    isFirstVisit,
  );
}
