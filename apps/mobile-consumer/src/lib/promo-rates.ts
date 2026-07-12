// Port of apps/web-consumer/src/lib/promo-rates.ts — reward matrix helpers.

import type { ConsumerClassKey } from '@/lib/types/place-detail';

export type PromoTierRates = {
  free: number | null;
  premium: number | null;
};

export type PromoMatrix = {
  welcome: PromoTierRates;
  default: PromoTierRates;
  is_first_visit: boolean;
};

function positiveRate(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null;
  return v;
}

export function hasExplicitTierRates(row: Record<string, unknown>): boolean {
  return (
    positiveRate(row.welcome_free_rate) != null ||
    positiveRate(row.welcome_premium_rate) != null ||
    positiveRate(row.free_rate) != null ||
    positiveRate(row.premium_rate) != null
  );
}

export function buildPromoMatrixFromRow(
  row: Record<string, unknown>,
  _listingType: 'partner' | 'web',
): PromoMatrix {
  return {
    welcome: {
      free: positiveRate(row.welcome_free_rate),
      premium: positiveRate(row.welcome_premium_rate),
    },
    default: {
      free: positiveRate(row.free_rate),
      premium: positiveRate(row.premium_rate),
    },
    is_first_visit: row.is_first_visit !== false,
  };
}

export function promoMatrixHasAnyRate(matrix: PromoMatrix): boolean {
  return (
    matrix.welcome.free != null ||
    matrix.welcome.premium != null ||
    matrix.default.free != null ||
    matrix.default.premium != null
  );
}

export function resolveActivePromoRate(
  matrix: PromoMatrix,
  classKey: ConsumerClassKey,
  isFirstVisit = matrix.is_first_visit,
): number | null {
  const welcome = matrix.welcome[classKey];
  const returning = matrix.default[classKey];
  return (
    (isFirstVisit ? (welcome ?? returning) : (returning ?? welcome)) ?? null
  );
}

export function placeOffersMesitaRewards(input: {
  listing_type: 'partner' | 'web';
  promo_matrix: PromoMatrix;
  promo_configured: boolean;
}): boolean {
  if (!promoMatrixHasAnyRate(input.promo_matrix)) return false;
  if (input.listing_type === 'partner') return true;
  return input.promo_configured;
}

export function resolvePromoRateFromPlaceRow(
  row: Record<string, unknown>,
  isFirstVisit: boolean,
  premium = false,
): number | null {
  const listingType = row.listing_type === 'partner' ? 'partner' : 'web';
  const matrix = buildPromoMatrixFromRow(row, listingType);
  if (
    !placeOffersMesitaRewards({
      listing_type: listingType,
      promo_matrix: matrix,
      promo_configured: hasExplicitTierRates(row),
    })
  ) {
    return null;
  }
  return resolveActivePromoRate(
    matrix,
    premium ? 'premium' : 'free',
    isFirstVisit,
  );
}
