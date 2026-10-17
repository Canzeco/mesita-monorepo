// Catalog Search. One shared profile, one list per guest family.
//
// Family and Enriched admit; they do not score. Timing is not in this
// profile. catalogScore multiplies only proximity, popularity, and
// randomness, and it raises them to RELATIVE exponents (weight / sum of
// the nonzero live weights). Name, description, and selected may still sit
// on the stored blob; this function does not read them. Weight 0 drops a
// live signal. All three at 0 leaves every place at 1 (incoming order).
// A save of that vector is rejected before it is stored.

import { FAMILIES, type FamilyKey } from "./place-taxonomy.ts";
import {
  popularity,
  proximity,
  randomness,
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

export type CatalogFamilyList<T extends CatalogListPlace> = {
  key: FamilyKey;
  label: string;
  emoji: string;
  source: "family";
  places: T[];
};

const GUEST_FAMILIES = FAMILIES.filter((f) => f.slug !== "undefined");

/** Enriched gate: a completed Enrich run, and a profile that can be shown. */
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
  if (relative.randomness > 0) {
    apply("randomness", randomness(place, intent));
  }
  return score;
}

/**
 * Fifteen lists in family order. A place in two families is in both lists.
 * Undefined is internal and never a list. Empty lists are omitted.
 * Ties keep the incoming order. Omitting `perList` returns every member.
 */
export function rankFamilyLists<T extends CatalogListPlace>(
  rows: readonly T[],
  places: readonly SignalPlace[],
  ranking: Record<CatalogRankKey, number>,
  params: SignalParams,
  intent: SignalIntent,
  perList?: number,
  enrichedOnly = true,
): CatalogFamilyList<T>[] {
  const unlimited = perList == null;
  const cap = unlimited ? 0 : Math.max(0, Math.floor(perList));
  const scored = rows.map((row, i) => ({
    row,
    place: places[i],
    score: places[i] ? catalogScore(places[i], ranking, params, intent) : 0,
    index: i,
  }));

  const lists: CatalogFamilyList<T>[] = [];
  for (const family of GUEST_FAMILIES) {
    const members = scored
      .filter((s) =>
        (enrichedOnly
          ? catalogAdmitted(s.row)
          : s.row.content_state === "ready") &&
        placeBelongsToFamily(s.row.family_keys, family.slug)
      )
      .sort((a, b) => b.score - a.score || a.index - b.index);
    if (members.length === 0 || (!unlimited && cap === 0)) continue;
    lists.push({
      key: family.slug,
      label: family.label,
      emoji: family.emoji,
      source: "family",
      places: (unlimited ? members : members.slice(0, cap)).map((m) => m.row),
    });
  }
  return lists;
}
