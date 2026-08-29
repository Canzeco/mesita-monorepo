// Swipe ranking — Places Lineup under the locked Swipe mask (Pato, 2026-08-28).
//
// Home UI is Soon. The deck endpoint is still live (mobile Home). Admission
// cuts first; rankByBlend then scores under weightsForMode("swipe"):
// proximity, timing, category, popularity, partnership, randomness.
// Name, Summary, and Social stay 0. The 2026-08-26 two-signal SUM and
// partnerBias / randomnessMax multipliers are retired — those knobs stay
// on the blob, unread.
//
//   1. ADMIT  — ready, review floor, operator radius, Map type batteries,
//               open now + closing buffer, then guest predicates.
//   2. RANK   — Places Lineup Π s^w with the Swipe mask.
//
// Distance is Haversine inside the Proximity signal. No Google call.
// Category abstains when the guest sent no intent (the usual Swipe case).

import { isOpenNow } from "./local-time-open.ts";
import {
  rankByBlend,
  type SignalParamsByKey,
  type SignalWeights,
} from "./discovery-blend.ts";
import { weightsForMode } from "./discovery-matrix.ts";
import { toLineupPlace } from "./discovery-place.ts";
import type { DiscoveryFilters, SwipeConfig } from "./discovery-config.ts";
import type { SignalKey } from "./discovery-signals.ts";
import { familiesForPlace } from "./place-taxonomy.ts";

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

export function swipeLineupWeights(
  global: Record<SignalKey, number>,
): SignalWeights {
  return weightsForMode("swipe", global);
}

export type SwipeRankOpts = {
  categories?: string[];
  families?: string[];
  now?: Date;
  random?: () => number;
};

function toSwipeLineupPlace(row: Record<string, unknown>) {
  const place = toLineupPlace(row);
  return { ...place, family_keys: familiesForPlace(place) };
}

/** Places Lineup under the Swipe mask. Admission must already have run. */
export function rankSwipeDeck<T>(
  rows: T[],
  geo: { lat: number; lng: number } | null,
  weights: SignalWeights,
  params?: SignalParamsByKey,
  opts?: SwipeRankOpts,
): T[] {
  return rankByBlend(
    rows,
    (row) => toSwipeLineupPlace(row as unknown as Record<string, unknown>),
    {
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      categories: opts?.categories,
      families: opts?.families,
      now: opts?.now,
      random: opts?.random,
    },
    weights,
    params,
  ).map((r) => r.row);
}
