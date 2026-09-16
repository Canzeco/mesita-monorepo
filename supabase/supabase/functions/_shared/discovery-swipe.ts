// Scroll ranking — Places Lineup under the locked Swipe mask (Pato, 2026-08-28).
//
// The engine key stays `swipe`; the surface is Home's Scroll pill since
// MESITA-1697. Admission cuts first; the blend then scores under
// the Scroll column of `weightsByMode` under the Scroll mask: proximity,
// timing, category, popularity, enriched, partnered, randomness. Name,
// Summary and Social stay 0. The 2026-08-26 two-signal SUM and its
// partnerBias / randomnessMax multipliers are gone — MESITA-1859 deleted
// those five unread fields off the blob rather than leave them beside a live
// per-mode exponent.
//
//   1. ADMIT  — ready, review floor, operator radius, Map type batteries,
//               open now + closing buffer, then guest predicates.
//   2. RANK   — Places Lineup Π s^w with the Swipe mask.
//   3. SLOT   — the bought lane: every Nth position is a slot a promoting
//               place is MOVED FORWARD into. MESITA-1855.
//
// LANE 2 RUNS HERE (MESITA-1855). Until then `slotPromoted` had no production
// caller anywhere — three tests asserted the absence — so the retired
// `mesita_level` exponent was the only live path from what a place pays to
// where it ranks. That is the
// thing the two-lane split exists to prevent: money is supposed to buy a
// POSITION, and the position pass was dead code. Scroll is where it belongs,
// because Scroll is a single ranked deck, which is exactly what slotPromoted
// takes. Map slots inside each of its listed lanes instead (nearby-lineup.ts).
//
// Distance is Haversine inside the Proximity signal. No Google call.
// Category abstains when the guest sent no intent (the usual Swipe case).

import { isOpenNow } from "./local-time-open.ts";
import {
  discoveryRank,
  type SignalParamsByKey,
  type SignalWeights,
  type SlottingConfig,
} from "./discovery-blend.ts";
import { weightsForMode } from "./discovery-matrix.ts";
import { toLineupPlace, toPromotingFields } from "./discovery-place.ts";
import type {
  DiscoveryConfig,
  DiscoveryFilters,
  SwipeConfig,
} from "./discovery-config.ts";
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

/**
 * Scroll's exponent vector: the Scroll column, under the Scroll mask.
 *
 * The EF calls THIS, never `weightsForMode` directly — the mode key belongs to
 * one named function per mode so the console's "who reads this column" badge
 * stays checkable, and discovery-swipe.test.ts pins both halves of that.
 */
export function swipeLineupWeights(
  cfg: Pick<DiscoveryConfig, "weights" | "weightsByMode">,
): SignalWeights {
  return weightsForMode("swipe", cfg.weights, cfg.weightsByMode);
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

/**
 * Places Lineup under the Swipe mask, then the bought slots. Admission must
 * already have run.
 *
 * `slotting` is required, not optional, and that is deliberate: an optional
 * bought lane is how this one sat unwired for three weeks while the console
 * kept storing the knob. A caller that wants merit order says so with
 * `{ enabled: false }`.
 */
export function rankSwipeDeck<T>(
  rows: T[],
  geo: { lat: number; lng: number } | null,
  weights: SignalWeights,
  slotting: SlottingConfig,
  params?: SignalParamsByKey,
  opts?: SwipeRankOpts,
): T[] {
  return discoveryRank(
    rows,
    (row) => toSwipeLineupPlace(row as unknown as Record<string, unknown>),
    (row) => toPromotingFields(row as unknown as Record<string, unknown>),
    {
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      categories: opts?.categories,
      families: opts?.families,
      now: opts?.now,
      random: opts?.random,
    },
    weights,
    slotting,
    params,
  ).map((r) => r.row);
}
