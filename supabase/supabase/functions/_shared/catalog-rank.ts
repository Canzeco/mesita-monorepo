// Catalog Search. One shared profile, one list per guest family.
//
// Family and Enriched admit; they do not score. Timing is not in this
// profile. catalogScore multiplies only proximity, popularity, and
// randomness, and it raises them to RELATIVE exponents (weight / sum of
// the nonzero live weights). Name, description, and selected may still sit
// on the stored blob; this function does not read them. Weight 0 drops a
// live signal. All three at 0 leaves every place at 1 (incoming order).
// A save of that vector is rejected before it is stored.

import { FAMILIES } from "./place-taxonomy.ts";
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
  key: string;
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
 * All, then one list per guest family. That is always n + 1 lists when
 * anyone is admitted: n guest families, plus the universal list. A place
 * in two families is in both of those lists, and also in All. Undefined
 * is never its own list. A family with no members is still a list, and
 * its places array is empty. Ties keep the incoming order. Omitting
 * `perList` returns every member.
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
  const admitted = (row: T) =>
    enrichedOnly ? catalogAdmitted(row) : row.content_state === "ready";
  const take = (
    members: typeof scored,
  ): T[] => (unlimited ? members : members.slice(0, cap)).map((m) => m.row);

  const lists: CatalogFamilyList<T>[] = [];
  const everyone = scored
    .filter((s) => admitted(s.row))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  if (everyone.length === 0 || (!unlimited && cap === 0)) return lists;
  lists.push({
    key: "all",
    label: "All",
    emoji: "·",
    source: "family",
    places: take(everyone),
  });
  for (const family of GUEST_FAMILIES) {
    const members = scored
      .filter((s) =>
        admitted(s.row) &&
        placeBelongsToFamily(s.row.family_keys, family.slug)
      )
      .sort((a, b) => b.score - a.score || a.index - b.index);
    lists.push({
      key: family.slug,
      label: family.label,
      emoji: family.emoji,
      source: "family",
      places: members.length === 0 ? [] : take(members),
    });
  }
  return lists;
}
