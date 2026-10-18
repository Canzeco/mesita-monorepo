// Catalog Search — the Feed's rails (MESITA-2302), top to bottom:
//   1. Google Places — `selectGooglePlaces`, the Map's Google scope on the
//      Feed: Google appears here and nowhere else, and only this rail may
//      use the central reviews floor.
//   2. Mesita Selected — `selectMesitaSelected`, the Map's Selected scope.
//   3. One rail per guest family, holding Mesita Selected places only.
// At most 5 places per rail; empty rails are omitted. Right Now and
// Universal are gone.
//
// Family picks the rail; it does not score. Timing is not in this profile.
// catalogScore multiplies only the Catalog ranking's live keys (proximity,
// popularity: Enriched is the gate, Randomness is pinned to 0), raised to
// RELATIVE exponents (weight / sum of the nonzero live weights). Name,
// description, selected, enriched and randomness may still sit on the
// stored blob; this function does not read them. Weight 0 drops a live
// signal. Both at 0 leaves every place at 1 (incoming order). A save of
// that vector is rejected before it is stored.

import { FAMILIES } from "./place-taxonomy.ts";
import {
  popularity,
  proximity,
  type SignalIntent,
  type SignalPlace,
} from "./discovery-signals.ts";
import { isEnrichedPlace } from "./place-family-keys.ts";
import {
  type CatalogLiveRankKey,
  type CatalogRankKey,
  catalogRelativeExponents,
  type SignalParams,
} from "./discovery-config.ts";

export type CatalogListPlace = Record<string, unknown> & {
  id: string;
  family_keys?: string[] | null;
  content_state?: string | null;
};

export type CatalogRail<T> = {
  key: string;
  label: string;
  emoji: string;
  source: "signal" | "family";
  places: T[];
};

/** Every rail carries at most this many places. */
export const CATALOG_RAIL_CAP = 5;

const GUEST_FAMILIES = FAMILIES.filter((f) => f.slug !== "undefined");

/** The enriched ring: a completed Enrich run, and a profile that can be shown. */
export function catalogAdmitted(row: {
  enriched_at?: string | null;
  content_state?: string | null;
}): boolean {
  return isEnrichedPlace(row) && row.content_state === "ready";
}

export function placeBelongsToFamily(
  familyKeys: readonly string[] | null | undefined,
  family: string,
): boolean {
  return Array.isArray(familyKeys) && familyKeys.includes(family);
}

/**
 * Score one admitted place. Abstentions return null from the signal and
 * are skipped; a real 0 (proximity past its radius) still multiplies.
 */
export function catalogScore(
  place: SignalPlace,
  ranking: Record<CatalogRankKey, number>,
  params: SignalParams,
  intent: SignalIntent,
): number {
  let score = 1;
  const relative = catalogRelativeExponents(ranking);
  const apply = (key: CatalogLiveRankKey, value: number | null) => {
    const w = relative[key];
    if (!(w > 0) || value == null || !Number.isFinite(value)) return;
    score *= Math.pow(Math.max(0, value), w);
  };
  apply("proximity", proximity(place, intent, params.proximity));
  apply("popularity", popularity(place, undefined, params.popularity));
  return score;
}

/** Rail 1's key and words. */
export const GOOGLE_PLACES_RAIL = {
  key: "google_places",
  label: "Google Places",
  emoji: "📍",
} as const;
/** Rail 2's key and words. */
export const MESITA_SELECTED_RAIL = {
  key: "mesita_selected",
  label: "Mesita Selected",
  emoji: "✨",
} as const;

/**
 * The Feed's rails from the engine's two answers. `google` can only land in
 * rail 1; `selected` is re-checked against `catalogAdmitted`, so a Google
 * stub or a Created row cannot reach rail 2 or a family rail. Both lists
 * arrive ranked; this keeps their order. A place in two families is in both
 * rails. Undefined is never a rail.
 */
export function buildCatalogRails<
  G extends Record<string, unknown>,
  S extends CatalogListPlace,
>(
  google: readonly G[],
  selected: readonly S[],
): CatalogRail<G | S>[] {
  const rails: CatalogRail<G | S>[] = [];
  if (google.length > 0) {
    rails.push({
      ...GOOGLE_PLACES_RAIL,
      source: "signal",
      places: google.slice(0, CATALOG_RAIL_CAP),
    });
  }
  const admitted = selected.filter((row) => catalogAdmitted(row));
  if (admitted.length > 0) {
    rails.push({
      ...MESITA_SELECTED_RAIL,
      source: "signal",
      places: admitted.slice(0, CATALOG_RAIL_CAP),
    });
  }
  for (const family of GUEST_FAMILIES) {
    const members = admitted.filter((row) =>
      placeBelongsToFamily(row.family_keys, family.slug)
    );
    if (members.length === 0) continue;
    rails.push({
      key: family.slug,
      label: family.label,
      emoji: family.emoji,
      source: "family",
      places: members.slice(0, CATALOG_RAIL_CAP),
    });
  }
  return rails;
}
