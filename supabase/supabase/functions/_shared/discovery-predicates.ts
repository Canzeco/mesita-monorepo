// The PREDICATE lane of Discovery, server-side (MESITA-1153).
//
// Docs › Discovery states the rule the whole surface hangs on: predicates CUT,
// signals RANK, and a predicate cuts FIRST. Until this module existed only
// half of that was true. The consumer narrowed the deck in the browser
// (`lib/discovery-filters-engine.ts`) while the engine had already ranked the
// whole catalog and sliced the top `limit` — so the guest's predicates ran
// over a 50-row sample, not over the catalog. With a catalog comfortably past
// the slice, "one family + a review floor" can come back nearly empty while
// the catalog holds plenty of matches, and the failure looks exactly like
// "Mesita has nothing near me". Cutting here, before the blend, is the fix:
// the slice is then taken from places that already match.
//
// THE CLIENT STILL FILTERS. This is not redundancy for its own sake — the deck
// is fetched by a server component before the guest's filters (sessionStorage)
// are readable, so it is sent with no `predicates` at all. So a
// pass here must never be STRICTER than the browser's: an unparseable value
// degrades to no predicate and lets the browser make the call. Being
// permissive here costs a slightly larger pool; being stricter would delete a
// match the guest asked for, and nothing downstream could put it back.
//
// NOT `_shared/discovery-filters.ts` (MESITA-1276), which sits beside this
// one and is the other kind of cut entirely. That module is OPERATOR pool
// policy — catalog-wide admission rules a guest never sees and cannot express,
// pushed into the WHERE clause. This module is the GUEST's own predicates,
// which can only ever narrow further inside what the operator already
// admitted. Two lanes, same "cut before you rank" rule; a knob belongs to
// exactly one of them, and one is not a place to put the other.

import { familiesForPlace } from "./place-taxonomy.ts";

export const DECK_REVIEW_STOPS = [0, 10, 100, 1000, 10000] as const;

function clampReviewFloor(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  let best = 0;
  let bestD = Number.POSITIVE_INFINITY;
  for (const stop of DECK_REVIEW_STOPS) {
    const d = Math.abs(stop - n);
    if (d < bestD || (d === bestD && stop > best)) {
      best = stop;
      bestD = d;
    }
  }
  return best;
}

/**
 * The guest's predicates on the wire. Every field is optional: a client
 * that sends none (or no `predicates` at all) gets the whole pool, which is the
 * pre-MESITA-1153 behaviour.
 *
 * Web (MESITA-1792) sends Family, Places scope, and Google review floor.
 * Places scope cuts nothing here: every row these pools hold is a Mesita row,
 * and a Mesita row sits in both rings, so only the browser — which also holds
 * Google stubs — has anything to narrow.
 */
export type DeckPredicates = {
  familyKeys: string[];
  minReviews: number;
};

export const NO_DECK_PREDICATES: DeckPredicates = {
  familyKeys: [],
  minReviews: 0,
};

function stringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const s = v.trim();
    if (s) out.push(s);
  }
  return out;
}

/**
 * Sanitize whatever the client sent. Unknown shapes degrade to "no predicate"
 * rather than throwing: a malformed filter must widen the deck, never 400 a
 * guest out of the only surface Home has.
 */
export function readDeckPredicates(raw: unknown): DeckPredicates {
  if (!raw || typeof raw !== "object") return NO_DECK_PREDICATES;
  const f = raw as Record<string, unknown>;
  return {
    familyKeys: stringList(f.familyKeys),
    minReviews: clampReviewFloor(f.minReviews),
  };
}

/** Does this set actually drop rows? Mirrors `hasDiscoveryPredicates`. */
export function hasDeckPredicates(p: DeckPredicates): boolean {
  return p.familyKeys.length > 0 || p.minReviews > 0;
}

function matches(row: Record<string, unknown>, p: DeckPredicates): boolean {
  if (p.familyKeys.length > 0) {
    const families = familiesForPlace(row) as string[];
    if (!p.familyKeys.some((k) => families.includes(k))) return false;
  }

  if (p.minReviews > 0) {
    const count = typeof row.google_review_count === "number"
      ? row.google_review_count
      : typeof row.google_count === "number"
      ? row.google_count
      : null;
    if (typeof count !== "number" || count < p.minReviews) return false;
  }

  return true;
}

/**
 * Cut the pool down to the rows the guest asked for, BEFORE anything ranks it.
 * Returns the same array when nothing narrows, so the no-filter path allocates
 * nothing.
 */
export function applyDeckPredicates<T extends Record<string, unknown>>(
  rows: T[],
  p: DeckPredicates,
): T[] {
  if (!hasDeckPredicates(p)) return rows;
  return rows.filter((row) => matches(row, p));
}
