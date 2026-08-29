// The PREDICATE lane of Discovery, server-side (MESITA-1153).
//
// Docs › Discovery states the rule the whole surface hangs on: predicates CUT,
// signals RANK, and a predicate cuts FIRST. Until this module existed only
// half of that was true. The consumer narrowed the deck in the browser
// (`lib/discovery-filters-engine.ts`) while the engine had already ranked the
// whole catalog and sliced the top `limit` — so the four guest predicates ran
// over a 50-row sample, not over the catalog. With a catalog comfortably past
// the slice, "open now + one family + 2 km" can come back nearly empty while
// the catalog holds plenty of matches, and the failure looks exactly like
// "Mesita has nothing near me". Cutting here, before the blend, is the fix:
// the slice is then taken from places that already match.
//
// It also repairs the BOUGHT lane. Slotting moves a promoting place into every
// Nth deck position; a client-side cut afterwards deletes those positions at
// random. Cut first and the slot count is the count the guest actually sees.
//
// THE CLIENT STILL FILTERS. This is not redundancy for its own sake — the deck
// is fetched by a server component before the guest's filters (sessionStorage)
// are readable, and deployed Expo binaries never send `predicates` at all. So a
// pass here must never be STRICTER than the browser's: where this module
// cannot evaluate a predicate (no center for a radius, an unparseable value)
// it keeps the row and lets the browser make the call. Being permissive here
// costs a slightly larger pool; being stricter would delete a match the guest
// asked for, and nothing downstream could put it back.
//
// NOT `_shared/discovery-filters.ts` (MESITA-1276), which sits beside this
// one and is the other kind of cut entirely. That module is OPERATOR pool
// policy — catalog-wide admission rules a guest never sees and cannot express,
// pushed into the WHERE clause. This module is the GUEST's own four
// predicates, which can only ever narrow further inside what the operator
// already admitted. Two lanes, same "cut before you rank" rule; a knob belongs
// to exactly one of them, and one is not a place to put the other.
//
// One deliberate divergence: "open now" is judged in the place's LOCAL time
// derived from longitude (`local-time.ts`, which documents why it ignores the
// `timezone` column) while the browser reads `places.timezone`. Both are
// DST-aware; they can disagree only for a place whose stored timezone
// contradicts its coordinates, and the browser's answer wins because it runs
// last.

import { familiesForPlace } from "./place-taxonomy.ts";
import { isPlacePromoting, type PromotingFields } from "./place-promoting.ts";
import { haversineKm } from "./geo.ts";
import { isOpenAt, isOpenNow } from "./local-time.ts";

/** Sunday-first, matching JS `getDay()` and the browser's `DiscoveryWhen`. */
const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/** The CONTEXT axis (promos v11). `order` is parked and narrows nothing. */
export type DeckContext = "any" | "visit" | "order";

export type DeckWhen =
  | { mode: "anytime" }
  | { mode: "now" }
  | { mode: "at"; day: number; hour: number };

/**
 * The guest's four predicates on the wire. Every field is optional: a client
 * that sends none (or no `predicates` at all) gets the whole pool, which is the
 * pre-MESITA-1153 behaviour and what every deployed Expo binary does.
 */
export type DeckPredicates = {
  context: DeckContext;
  familyKeys: string[];
  categories: string[];
  maxKm: number | null;
  when: DeckWhen;
};

export const NO_DECK_PREDICATES: DeckPredicates = {
  context: "any",
  familyKeys: [],
  categories: [],
  maxKm: null,
  when: { mode: "anytime" },
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

function readWhen(raw: unknown): DeckWhen {
  if (!raw || typeof raw !== "object") return { mode: "anytime" };
  const w = raw as Record<string, unknown>;
  if (w.mode === "now") return { mode: "now" };
  if (w.mode === "at" && typeof w.day === "number" && typeof w.hour === "number") {
    if (!Number.isFinite(w.day) || !Number.isFinite(w.hour)) return { mode: "anytime" };
    const day = ((Math.round(w.day) % 7) + 7) % 7;
    const hour = Math.min(23, Math.max(0, Math.round(w.hour)));
    return { mode: "at", day, hour };
  }
  return { mode: "anytime" };
}

/**
 * Sanitize whatever the client sent. Unknown shapes degrade to "no predicate"
 * rather than throwing: a malformed filter must widen the deck, never 400 a
 * guest out of the only surface Home has.
 */
export function readDeckPredicates(raw: unknown): DeckPredicates {
  if (!raw || typeof raw !== "object") return NO_DECK_PREDICATES;
  const f = raw as Record<string, unknown>;
  const context: DeckContext =
    f.context === "visit" || f.context === "order" ? f.context : "any";
  const maxKm =
    typeof f.maxKm === "number" && Number.isFinite(f.maxKm) && f.maxKm > 0
      ? f.maxKm
      : null;
  return {
    context,
    familyKeys: stringList(f.familyKeys),
    categories: stringList(f.categories),
    maxKm,
    when: readWhen(f.when),
  };
}

/** Does this set actually drop rows? Mirrors `hasDiscoveryPredicates`. */
export function hasDeckPredicates(p: DeckPredicates): boolean {
  return (
    p.context === "visit" ||
    p.familyKeys.length > 0 ||
    p.categories.length > 0 ||
    p.maxKm !== null ||
    p.when.mode !== "anytime"
  );
}

/** The center distances are measured from — a searched zone or the device fix. */
export type DeckCenter = { lat: number; lng: number } | null;

function matches(
  row: Record<string, unknown>,
  p: DeckPredicates,
  center: DeckCenter,
  now: Date,
): boolean {
  // Context cuts first, exactly as the bill engine resolves it. `visit` keeps
  // only places running a live reward; `order` is parked, so it narrows
  // nothing rather than inventing a remote catalog we do not have.
  if (p.context === "visit" && !isPlacePromoting(row as unknown as PromotingFields, now)) {
    return false;
  }

  // What — OR across the two tiers (super-family or concrete category).
  if (p.familyKeys.length > 0 || p.categories.length > 0) {
    const category = typeof row.category === "string" ? row.category : null;
    const categoryHit = category != null && p.categories.includes(category);
    const families = familiesForPlace(row) as string[];
    const familyHit = p.familyKeys.some((k) => families.includes(k));
    if (!categoryHit && !familyHit) return false;
  }

  // Distance tolerance. With no center we cannot evaluate it at all, so the
  // row survives and the browser — which always has one — decides.
  if (p.maxKm !== null && center) {
    const lat = typeof row.lat === "number" ? row.lat : null;
    const lng = typeof row.lng === "number" ? row.lng : null;
    if (lat === null || lng === null) return false;
    if (haversineKm(center.lat, center.lng, lat, lng) > p.maxKm) return false;
  }

  // When. No usable hours = cannot confirm open = excluded, the same call the
  // browser makes; `isOpenAt` / `isOpenNow` return null for that case.
  if (p.when.mode !== "anytime") {
    const lng = typeof row.lng === "number" ? row.lng : null;
    const open =
      p.when.mode === "at"
        ? isOpenAt(row.hours, DAY_KEYS[p.when.day], p.when.hour * 60)
        : isOpenNow(row.hours, lng);
    if (open !== true) return false;
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
  center: DeckCenter,
  now: Date = new Date(),
): T[] {
  if (!hasDeckPredicates(p)) return rows;
  return rows.filter((row) => matches(row, p, center, now));
}
