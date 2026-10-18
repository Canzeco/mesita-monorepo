// The Google scope's ranking inputs (MESITA-2302): the Map column's
// exponent vector, the intent the enabled type batteries imply, and the
// lineup projection with families. `nearby-selection.ts` ranks Google Places
// with them on the Map and on the Feed's Google Places rail alike.

import type { SignalWeights } from "./discovery-blend.ts";
import { weightsForMode } from "./discovery-matrix.ts";
import { toLineupPlace } from "./discovery-place.ts";
import type { DiscoveryConfig } from "./discovery-config.ts";
import { familiesForGoogleType, type FamilyKey } from "./sourcing.ts";
import { familiesForPlace } from "./place-taxonomy.ts";

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
 * ENFORCED: it ranks every Google Places answer, on the Map and on the
 * Feed's rail 1 (`selectGooglePlaces`, MESITA-2302).
 */
export function mapLineupWeights(
  cfg: Pick<DiscoveryConfig, "weights" | "weightsByMode">,
): SignalWeights {
  return weightsForMode("map", cfg.weights, cfg.weightsByMode);
}

export function toMapLineupPlace(row: Record<string, unknown>) {
  const place = toLineupPlace(row);
  return { ...place, family_keys: familiesForPlace(place) };
}
