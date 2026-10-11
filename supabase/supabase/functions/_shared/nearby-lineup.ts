// Map listed-lane reorder. `nearby-places.ts` stays geo-only: closest-N
// admit, then this opt-in pass ranks listed pins with Places Lineup.
//
// Default `mergeNearbyCatalog` order is unchanged (Pay PlacePickList and
// frozen mobile Search). Only consumer-web-list-places `{ google: true }`
// listed sets call this after the closest-N cut. The Google set stays
// distance order.

import {
  rankByBlend,
  type SignalParamsByKey,
  type SignalWeights,
} from "./discovery-blend.ts";
import { weightsForMode } from "./discovery-matrix.ts";
import { toLineupPlace } from "./discovery-place.ts";
import type { DiscoveryConfig } from "./discovery-config.ts";
import type { MesitaNearbyRow, NearbyMerged } from "./nearby-places.ts";
import { familiesForGoogleType, type FamilyKey } from "./sourcing.ts";
import { familiesForPlace } from "./place-taxonomy.ts";

export type ListedLineupOpts = {
  center: { lat: number; lng: number };
  weights: SignalWeights;
  params?: SignalParamsByKey;
  categories?: string[];
  families?: string[];
  now?: Date;
};

/** Enabled Nearby type batteries + the families those types belong to. */
export function mapLineupIntent(types: readonly string[]): {
  categories: string[];
  families: FamilyKey[];
} {
  const families = [
    ...new Set(types.flatMap((t) => familiesForGoogleType(t))),
  ];
  return { categories: [...types], families };
}

/**
 * Map's exponent vector: the Map column, under the Map mask.
 *
 * CONDITIONALLY READ, and the console says so. `consumer-web-list-places`
 * skips `reorderListedLanes` entirely when the Google-fill branch returned
 * rows, so this vector ranks only when Google fill came back empty — which is
 * why the Map column's badge is `fallback`, not `enforced`.
 */
export function mapLineupWeights(
  cfg: Pick<DiscoveryConfig, "weights" | "weightsByMode">,
): SignalWeights {
  return weightsForMode("map", cfg.weights, cfg.weightsByMode);
}

function toMapLineupPlace(row: Record<string, unknown>) {
  const place = toLineupPlace(row);
  return { ...place, family_keys: familiesForPlace(place) };
}

/**
 * Blend the listed rows, then Google after them (distance, unchanged).
 * On throw, return the closest-N merge order.
 */
export function reorderListedLanes<T extends MesitaNearbyRow>(
  merged: Array<NearbyMerged<T>>,
  opts: ListedLineupOpts,
): Array<NearbyMerged<T>> {
  try {
    const listed: T[] = [];
    const google: Array<Extract<NearbyMerged<T>, { kind: "google" }>> = [];
    for (const item of merged) {
      if (item.kind === "google") google.push(item);
      else listed.push(item.row);
    }
    const intent = {
      lat: opts.center.lat,
      lng: opts.center.lng,
      categories: opts.categories,
      families: opts.families,
      now: opts.now,
    };
    const ranked = rankByBlend(
      listed,
      (row) => toMapLineupPlace(row as unknown as Record<string, unknown>),
      intent,
      opts.weights,
      opts.params,
    ).map((r) => ({ kind: "listed" as const, row: r.row }));
    return [...ranked, ...google];
  } catch {
    return merged;
  }
}
