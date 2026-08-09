import type { ConsumerClass } from "@/lib/mock/place";

// Per-class promo rates. The `free`/`premium` keys mirror the v4 places
// columns (welcome_free_rate / free_rate / …) — the DB column vocabulary is
// unchanged (per-segment place columns are a not-yet-landed backend follow-up,
// MESITA-723). The consumer class → column mapping lives in
// resolveActivePromoRate: Standard reads `free`; every elevated class
// (Premium / Influencer / Aura) reads `premium`.
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

function resolveActivePromoRate(
  matrix: PromoMatrix,
  classKey: ConsumerClass,
  isFirstVisit = matrix.is_first_visit,
): number | null {
  // Standard reads the `free` column; every elevated class (Premium /
  // Influencer / Aura) reads `premium` — the v4 columns only know the binary
  // free-vs-elevated split.
  const col: keyof PromoClassRates =
    classKey === "standard" ? "free" : "premium";
  const welcome = matrix.welcome[col];
  const returning = matrix.default[col];
  return (
    (isFirstVisit ? (welcome ?? returning) : (returning ?? welcome)) ?? null
  );
}

// ── Strategy derivation (v7, MESITA-861) ────────────────────────────────
//
// Three strategies — zero / conservative / aggressive. The four place rate
// columns ARE the strategy (a membership writes them as one preset — admin-
// web-set-plan refuses partial grids), so the client recovers it by exact
// preset match, mirroring _shared/lineup-strategy.ts. null/custom coerces to
// "zero", same as the bill engine.
export type PlaceStrategy = "zero" | "conservative" | "aggressive";

const STRATEGY_PRESETS: {
  id: PlaceStrategy;
  w_free: number | null;
  w_prem: number | null;
  free: number | null;
  prem: number | null;
}[] = [
  { id: "zero", w_free: null, w_prem: null, free: null, prem: null },
  { id: "conservative", w_free: 20, w_prem: 30, free: 10, prem: 20 },
  { id: "aggressive", w_free: 30, w_prem: 50, free: 10, prem: 30 },
];

export function strategyForPromoMatrix(matrix: {
  welcome: { free: number | null; premium: number | null };
  default: { free: number | null; premium: number | null };
}): PlaceStrategy {
  const hit = STRATEGY_PRESETS.find(
    (s) =>
      s.w_free === matrix.welcome.free &&
      s.w_prem === matrix.welcome.premium &&
      s.free === matrix.default.free &&
      s.prem === matrix.default.premium,
  );
  return hit?.id ?? "zero";
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

/**
 * The strategy a place row is running, straight from its four rate columns
 * (MESITA-869). Any surface holding a place summary — swipe card, place
 * detail, a ticket — can quote that place's REAL numbers instead of the
 * static peak: `REWARD_SEGMENT_BY_KEY.review.rates[strategyForPlaceRow(row)]`.
 * Custom or cleared rates coerce to "zero", exactly like the bill engine, so
 * the caller shows no percentage rather than a wrong one.
 */
export function strategyForPlaceRow(
  row: Record<string, unknown> | null | undefined,
): PlaceStrategy {
  if (!row) return "zero";
  return strategyForPromoMatrix(buildPromoMatrixFromRow(row, "partner"));
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
