// Catalog Search (MESITA-2196). One shared profile, seven guest family lists.
//
// Family and Enriched admit; they do not score. Timing is not in this
// profile. Name, Description, and Selected abstain until a query vector or
// a per-entity Selected value exists — a missing fact is not a zero, and a
// zero would delete the place from the product. Weight 0 drops its signal
// before it is called. Proximity and Popularity rank inside the gates.
// Randomness ships at exponent 0, so it is not called.

import { FAMILIES, type FamilyKey } from "./place-taxonomy.ts";
import {
  popularity,
  proximity,
  randomness,
  type SignalIntent,
  type SignalPlace,
} from "./discovery-signals.ts";
import { isEnrichedPlace } from "./place-family-keys.ts";
import type { CatalogRankKey, SignalParams } from "./discovery-config.ts";

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

function weightOf(ranking: Record<CatalogRankKey, number>, key: CatalogRankKey): number {
  const w = ranking[key];
  return typeof w === "number" && Number.isFinite(w) ? w : 0;
}

/** Enriched gate: a completed Enrich run, and a profile that can be shown. */
export function catalogAdmitted(row: {
  enriched_at?: string | null;
  content_state?: string | null;
}): boolean {
  return isEnrichedPlace(row) && row.content_state === "ready";
}

function belongsTo(row: CatalogListPlace, family: FamilyKey): boolean {
  return Array.isArray(row.family_keys) && row.family_keys.includes(family);
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
  const apply = (key: CatalogRankKey, value: number | null) => {
    const w = weightOf(ranking, key);
    if (!(w > 0) || value == null || !Number.isFinite(value)) return;
    score *= Math.pow(Math.max(0, value), w);
  };
  // No browse query, so Name and Description have nothing to compare.
  // No per-entity Selected column, so that exponent has nothing to raise.
  apply("proximity", proximity(place, intent, params.proximity));
  apply("popularity", popularity(place, undefined, params.popularity));
  if (weightOf(ranking, "randomness") > 0) {
    apply("randomness", randomness(place, intent));
  }
  return score;
}

/**
 * Seven lists in family order. A place in two families is in both lists.
 * Undefined is internal and never a list. Empty lists are omitted.
 * Ties keep the incoming order.
 */
export function rankFamilyLists<T extends CatalogListPlace>(
  rows: readonly T[],
  places: readonly SignalPlace[],
  ranking: Record<CatalogRankKey, number>,
  params: SignalParams,
  intent: SignalIntent,
  perList: number,
): CatalogFamilyList<T>[] {
  const cap = Math.max(0, Math.floor(perList));
  const scored = rows.map((row, i) => ({
    row,
    place: places[i],
    score: places[i] ? catalogScore(places[i], ranking, params, intent) : 0,
    index: i,
  }));

  const lists: CatalogFamilyList<T>[] = [];
  for (const family of GUEST_FAMILIES) {
    const members = scored
      .filter((s) => catalogAdmitted(s.row) && belongsTo(s.row, family.slug))
      .sort((a, b) => b.score - a.score || a.index - b.index);
    if (members.length === 0 || cap === 0) continue;
    lists.push({
      key: family.slug,
      label: family.label,
      emoji: family.emoji,
      source: "family",
      places: members.slice(0, cap).map((m) => m.row),
    });
  }
  return lists;
}
