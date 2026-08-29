// Swipe ranking — two signals, then a partner multiplier (Pato, 2026-08-26).
//
// Swipe is for guests who are not looking for anything specific. Specific
// intent belongs to Chat. Hard filters admit; a weighted SUM scores; partner
// bias multiplies after. This replaces the nine-signal `s^w` blend + bought
// slots FOR SWIPE ONLY. Catalog, Chat and Social stay pending.
//
//   score = (wP * proximity + (1 − wP) * popularity) * partner_bias
//           * Uniform[1, randomnessMax]
//
// Order of operations is load-bearing: admit the pool first (status, timing,
// radius, optional category, review floor), then score, then bias, then order.
// Partner bias cannot live inside the spatial index. Pre-ordering by distance
// and cutting would drop a biased partner near the radius edge before the
// bias can act.
//
// Distance is Haversine from stored coordinates — no Google call. Linear
// decay from 0 km (1) to the operator radius (0). Popularity is
// min(1, ln(stars^exponent * reviews) / divisor). Zero reviews are excluded
// before this formula runs; the product is then ≥ 1 and ln never goes
// negative.

import { haversineKm } from "./geo.ts";
import { isOpenNow } from "./local-time-open.ts";
import { isPaidPlan } from "./membership-enforcement-helpers.ts";
import { placePromotingLevel, type PromotingFields } from "./place-promoting.ts";
import {
  SWIPE_RANDOMNESS_MAX_MAX,
  SWIPE_RANDOMNESS_MAX_MIN,
  type DiscoveryFilters,
  type SwipeConfig,
  type SwipePartnerLevel,
} from "./discovery-config.ts";

/** Query predicates Swipe owns. Map type batteries stay a separate cut. */
export function swipeAdmissionFilters(swipe: SwipeConfig): DiscoveryFilters {
  return {
    requireReady: true,
    minRating: 0,
    minReviews: swipe.minReviews,
    maxDistanceKm: swipe.radiusKm,
  };
}

/**
 * Discrete timing filter: open now, and still open after the closing buffer.
 * Unknown hours / unresolvable clock → exclude. A card the guest cannot sit
 * down at does not belong on Swipe.
 */
export function admitSwipeTiming<T>(
  rows: T[],
  hoursOf: (row: T) => unknown,
  lngOf: (row: T) => number | null,
  bufferMin: number,
  at: Date = new Date(),
): T[] {
  return rows.filter((row) => {
    const hours = hoursOf(row);
    const lng = lngOf(row);
    const now = isOpenNow(hours, lng, at);
    if (now !== true) return false;
    if (!(bufferMin > 0)) return true;
    const later = new Date(at.getTime() + bufferMin * 60_000);
    return isOpenNow(hours, lng, later) === true;
  });
}

/** Linear decay. 1 at the guest, 0 at the radius. Missing km → 0. */
export function swipeProximity(km: number, radiusKm: number): number {
  if (!(radiusKm > 0) || !Number.isFinite(km) || km < 0) return 0;
  return Math.max(0, 1 - km / radiusKm);
}

/**
 * Popularity in [0, 1]. stars^exponent * reviews, ln, / divisor, clamp at 1.
 * Product < 1 (missing stars, zero reviews) scores 0 — the review floor
 * should already have excluded the undefined case.
 */
export function swipePopularity(
  stars: number,
  reviews: number,
  exponent: number,
  divisor: number,
): number {
  if (!(stars >= 1) || !(reviews >= 1) || !(divisor > 0)) return 0;
  const product = stars ** exponent * reviews;
  if (!(product >= 1) || !Number.isFinite(product)) return 0;
  return Math.min(1, Math.log(product) / divisor);
}

export function swipeBlend(
  proximity: number,
  popularity: number,
  weightProximity: number,
): number {
  const w = Math.min(1, Math.max(0, weightProximity));
  return w * proximity + (1 - w) * popularity;
}

export function swipePartnerLevel(
  row: PromotingFields | null | undefined,
  now: Date = new Date(),
): SwipePartnerLevel {
  if (!isPaidPlan(row?.plan ?? null)) return "none";
  switch (placePromotingLevel(row, now)) {
    case 1:
      return "conservative";
    case 2:
      return "aggressive";
    case 3:
      return "dominant";
    default:
      return "partner";
  }
}

export type SwipeRankRead<T> = {
  latOf: (row: T) => number | null;
  lngOf: (row: T) => number | null;
  starsOf: (row: T) => number | null;
  reviewsOf: (row: T) => number | null;
  partnerOf: (row: T) => PromotingFields | null | undefined;
};

/** Uniform[1, max]. max ≤ 1 is off. `unit` is one draw in [0, 1]. */
export function swipeJitter(unit: number, max: number): number {
  const hi = Number.isFinite(max)
    ? Math.min(SWIPE_RANDOMNESS_MAX_MAX, Math.max(SWIPE_RANDOMNESS_MAX_MIN, max))
    : SWIPE_RANDOMNESS_MAX_MIN;
  if (hi <= 1) return 1;
  const u = Number.isFinite(unit) ? Math.min(1, Math.max(0, unit)) : 0;
  return 1 + (hi - 1) * u;
}

/**
 * Score the admitted pool, apply partner bias, then a Uniform[1, randomnessMax]
 * draw per place so the deck does not freeze. Inject `rng` in tests.
 */
export function rankSwipeDeck<T>(
  rows: T[],
  geo: { lat: number; lng: number } | null,
  swipe: SwipeConfig,
  read: SwipeRankRead<T>,
  now: Date = new Date(),
  rng: () => number = Math.random,
): T[] {
  const scored = rows.map((row, i) => {
    const lat = read.latOf(row);
    const lng = read.lngOf(row);
    const km = geo && typeof lat === "number" && typeof lng === "number"
      ? haversineKm(geo.lat, geo.lng, lat, lng)
      : null;
    // No guest geo → proximity abstains at 1 so popularity + bias still rank.
    const proximity = geo == null
      ? 1
      : km == null
      ? 0
      : swipeProximity(km, swipe.radiusKm);
    const popularity = swipePopularity(
      read.starsOf(row) ?? 0,
      read.reviewsOf(row) ?? 0,
      swipe.starsExponent,
      swipe.logDivisor,
    );
    const level = swipePartnerLevel(read.partnerOf(row), now);
    const bias = swipe.partnerBias[level];
    const unit = rng();
    const score = swipeBlend(proximity, popularity, swipe.weightProximity) *
      bias *
      swipeJitter(unit, swipe.randomnessMax);
    return { row, i, score };
  });
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  return scored.map((x) => x.row);
}
