// Map listed-lane reorder. `nearby-places.ts` stays geo-only: closest-N
// admit, then this opt-in pass ranks listed pins with Places Lineup.
//
// Default `mergeNearbyCatalog` order is unchanged (Pay PlacePickList and
// frozen mobile Search). Only consumer-web-list-places `{ google: true }`
// listed sets call this after the closest-N cut. The Google set stays
// distance order.

import {
  discoveryRank,
  type SignalParamsByKey,
  type SignalWeights,
  type SlottingConfig,
} from "./discovery-blend.ts";
import { weightsForMode } from "./discovery-matrix.ts";
import { toLineupPlace, toPromotingFields } from "./discovery-place.ts";
import type { SignalKey } from "./discovery-signals.ts";
import {
  isMesitaPartnerRow,
  type MesitaNearbyRow,
  type NearbyMerged,
} from "./nearby-places.ts";
import { familiesForGoogleType, type FamilyKey } from "./sourcing.ts";
import { familiesForPlace } from "./place-taxonomy.ts";

export type ListedLineupOpts = {
  center: { lat: number; lng: number };
  weights: SignalWeights;
  /** The bought lane. Required, never optional — see rankSwipeDeck's note. */
  slotting: SlottingConfig;
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

export function mapLineupWeights(
  global: Record<SignalKey, number>,
): SignalWeights {
  return weightsForMode("map", global);
}

function toMapLineupPlace(row: Record<string, unknown>) {
  const place = toLineupPlace(row);
  return { ...place, family_keys: familiesForPlace(place) };
}

/**
 * Blend partner listed and Mesita-extra listed separately, then concat,
 * then Google (distance, unchanged). A cafe never jumps a partner.
 * On throw, return the closest-N merge order.
 *
 * SLOTTING RUNS INSIDE EACH LANE, NOT OVER THE CONCATENATION (MESITA-1855).
 * Two reasons. The lane split is already a bought mechanism — every partner
 * sits ahead of every non-partner — so slotting the joined list would price
 * the same money twice and mostly reshuffle a block that is already at the
 * front. And the lanes exist so a cafe never jumps a partner; a pass over
 * the concatenation could move a promoting cafe past one. Per lane, the
 * question slotting answers is the right one: among places that already sit
 * together, which of them bought the next position.
 */
export function reorderListedLanes<T extends MesitaNearbyRow>(
  merged: Array<NearbyMerged<T>>,
  opts: ListedLineupOpts,
): Array<NearbyMerged<T>> {
  try {
    const partners: T[] = [];
    const extra: T[] = [];
    const google: Array<Extract<NearbyMerged<T>, { kind: "google" }>> = [];
    for (const item of merged) {
      if (item.kind === "google") {
        google.push(item);
        continue;
      }
      if (isMesitaPartnerRow(item.row)) partners.push(item.row);
      else extra.push(item.row);
    }
    const intent = {
      lat: opts.center.lat,
      lng: opts.center.lng,
      categories: opts.categories,
      families: opts.families,
      now: opts.now,
    };
    const project = (row: T) =>
      toMapLineupPlace(row as unknown as Record<string, unknown>);
    const promotingOf = (row: T) =>
      toPromotingFields(row as unknown as Record<string, unknown>);
    const rank = (rows: T[]) =>
      discoveryRank(
        rows,
        project,
        promotingOf,
        intent,
        opts.weights,
        opts.slotting,
        opts.params,
      ).map((r) => ({ kind: "listed" as const, row: r.row }));
    return [...rank(partners), ...rank(extra), ...google];
  } catch {
    return merged;
  }
}
