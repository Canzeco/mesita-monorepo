// Catalog Search. The Feed is N + 2 rails (MESITA-2294): Right Now (open
// Mesita Created Places), Universal (Mesita Enriched Places), then one rail
// per guest family (enriched only). At most 5 places per rail; empty rails
// are omitted. With the guest's location, Right Now is Google places open
// now instead (MESITA-2295, `withGoogleRightNow`); the Mesita one is the
// fallback.
//
// Family picks the rail; it does not score. Timing is not in this profile.
// catalogScore multiplies only the Catalog ranking's live keys (proximity,
// popularity — MESITA-2302: Enriched is the gate, Randomness is pinned to
// 0), raised to RELATIVE exponents (weight / sum of the nonzero live
// weights). Name, description, selected, enriched and randomness may still
// sit on the stored blob; this function does not read them. Weight 0 drops
// a live signal. Both at 0 leaves every place at 1 (incoming order).
// A save of that vector is rejected before it is stored.

import { FAMILIES } from "./place-taxonomy.ts";
import {
  popularity,
  proximity,
  type SignalIntent,
  type SignalPlace,
} from "./discovery-signals.ts";
import { isEnrichedPlace } from "./place-family-keys.ts";
import { isOpenNow } from "./local-time-open.ts";
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

export type CatalogRail<T extends CatalogListPlace> = {
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

/**
 * The Feed is N + 2 rails, top to bottom:
 *   1. Right Now — Mesita Created Places (every ready row, enriched or
 *      not) that are open at `intent.now` on their own local clock.
 *      Proximity, then popularity, then incoming order.
 *   2. Universal — Mesita Enriched Places, by catalogScore.
 *   3. One rail per guest family — enriched members only, by
 *      catalogScore.
 * Every rail stops at CATALOG_RAIL_CAP.
 * Every empty rail is omitted. A place in two families is in both of those
 * rails. Undefined is never a rail. Ties keep the incoming order.
 */
export function rankCatalogRails<T extends CatalogListPlace>(
  rows: readonly T[],
  places: readonly SignalPlace[],
  ranking: Record<CatalogRankKey, number>,
  params: SignalParams,
  intent: SignalIntent,
): CatalogRail<T>[] {
  const now = intent.now ?? new Date();
  const scored = rows.map((row, i) => ({
    row,
    place: places[i],
    score: places[i] ? catalogScore(places[i], ranking, params, intent) : 0,
    index: i,
  }));
  const byScore = (a: typeof scored[number], b: typeof scored[number]) =>
    b.score - a.score || a.index - b.index;
  const rails: CatalogRail<T>[] = [];

  const open = scored
    .filter((s) =>
      s.row.content_state === "ready" && s.place &&
      isOpenNow(s.place.hours, s.place.lng ?? null, now) === true
    )
    .map((s) => ({
      ...s,
      near: proximity(s.place, intent, params.proximity),
      loved: popularity(s.place, undefined, params.popularity),
    }))
    .sort((a, b) => b.near - a.near || b.loved - a.loved || a.index - b.index);
  if (open.length > 0) {
    rails.push({
      key: "right_now",
      label: "Right Now",
      emoji: "🕒",
      source: "signal",
      places: open.slice(0, CATALOG_RAIL_CAP).map((s) => s.row),
    });
  }

  const enrichedRows = scored.filter((s) => catalogAdmitted(s.row)).sort(
    byScore,
  );
  if (enrichedRows.length > 0) {
    rails.push({
      key: "universal",
      label: "Universal",
      emoji: "✨",
      source: "signal",
      places: enrichedRows.slice(0, CATALOG_RAIL_CAP).map((s) => s.row),
    });
  }

  for (const family of GUEST_FAMILIES) {
    const members = enrichedRows.filter((s) =>
      placeBelongsToFamily(s.row.family_keys, family.slug)
    );
    if (members.length === 0) continue;
    rails.push({
      key: family.slug,
      label: family.label,
      emoji: family.emoji,
      source: "family",
      places: members.slice(0, CATALOG_RAIL_CAP).map((s) => s.row),
    });
  }
  return rails;
}

/**
 * Right Now from Google (MESITA-2295). Given the Google rail's places, they
 * replace the Mesita Right Now, or open the Feed when none was open. Null
 * or empty keeps the rails as ranked: the Mesita Created Places fallback.
 */
export function withGoogleRightNow<T extends CatalogListPlace>(
  rails: CatalogRail<T>[],
  google: readonly T[] | null,
): CatalogRail<T>[] {
  if (!google || google.length === 0) return rails;
  const rail: CatalogRail<T> = {
    key: "right_now",
    label: "Right Now",
    emoji: "🕒",
    source: "signal",
    places: google.slice(0, CATALOG_RAIL_CAP),
  };
  return [rail, ...rails.filter((r) => r.key !== "right_now")];
}
