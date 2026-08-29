// Map listed-lane reorder. `nearby-places.ts` stays geo-only: closest-N
// admit, then this opt-in pass ranks listed pins with Places Lineup.
//
// Default `mergeNearbyCatalog` order is unchanged (Pay PlacePickList and
// frozen mobile Search). Only consumer-web-list-places `{ google: true }`
// calls this after the closest-N cut.

import {
  rankByBlend,
  type SignalParamsByKey,
  type SignalWeights,
} from "./discovery-blend.ts";
import { weightsForMode } from "./discovery-matrix.ts";
import { toLineupPlace } from "./discovery-place.ts";
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
    const rank = (rows: T[]) =>
      rankByBlend(rows, project, intent, opts.weights, opts.params)
        .map((r) => ({ kind: "listed" as const, row: r.row }));
    return [...rank(partners), ...rank(extra), ...google];
  } catch {
    return merged;
  }
}
