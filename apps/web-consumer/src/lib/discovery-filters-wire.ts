// The guest's predicates, on the wire (MESITA-1153).
//
// `applyDiscoveryFilters` narrows a deck the engine has ALREADY ranked and
// sliced, so a narrow filter used to thin the deck instead of searching the
// catalog with it: `consumer-web-recommend-swipe` returns at most 50 places, so
// a predicate matching a fraction p of the catalog left ~50p cards however
// large the catalog grew. This module is the other half of the fix — it turns
// the filter state into the payload the EF cuts its POOL with, before ranking.
//
// The browser keeps filtering after the round trip. That is not belt-and-braces
// for its own sake: the first deck is fetched by a server component that cannot
// read sessionStorage, `when: "now"` drifts with the clock, and the EF is
// deliberately permissive where it cannot evaluate a predicate. Two passes, one
// rule set (`discovery-filters-engine.ts` is the law; the EF mirrors it).

import type { DiscoveryFilters } from "@/lib/discovery-filters-engine";
import { hasDiscoveryPredicates } from "@/lib/discovery-filters-engine";

/**
 * Exactly the shape `_shared/discovery-predicates.ts` reads. It rides the wire
 * as `predicates`, never `filters` — the EF already has a `filters` of its own
 * (`cfg.filters`, the OPERATOR's pool-admission policy from MESITA-1276), and
 * the two cut with different authority: an operator decides what may enter the
 * pool at all, a guest narrows within what they were shown.
 */
export type DiscoveryPredicatesWire = {
  context: DiscoveryFilters["context"];
  familyKeys: string[];
  categories: string[];
  maxKm: number | null;
  when: DiscoveryFilters["when"];
};

export type DeckCenter = { lat: number; lng: number } | null;

export type DeckRequest = {
  limit: number;
  lat?: number;
  lng?: number;
  predicates?: DiscoveryPredicatesWire;
};

/**
 * The center only reaches the server when a radius is set — that is the one
 * predicate that needs it. Sending it unconditionally would re-rank the deck
 * (lat/lng feed Proximity) the moment a geolocation fix lands, reshuffling
 * cards under a guest mid-swipe for no filter reason.
 */
function centerForRequest(f: DiscoveryFilters, center: DeckCenter): DeckCenter {
  return f.maxKm !== null ? center : null;
}

function toDiscoveryPredicatesWire(
  f: DiscoveryFilters,
): DiscoveryPredicatesWire {
  return {
    context: f.context,
    familyKeys: [...f.familyKeys],
    categories: [...f.categories],
    maxKm: f.maxKm,
    when: f.when,
  };
}

/** Build the deck request. No predicates set = the plain unfiltered call. */
export function toDeckRequest(
  f: DiscoveryFilters,
  center: DeckCenter,
  limit: number,
): DeckRequest {
  if (!hasDiscoveryPredicates(f)) return { limit };
  const c = centerForRequest(f, center);
  return {
    limit,
    ...(c ? { lat: c.lat, lng: c.lng } : {}),
    predicates: toDiscoveryPredicatesWire(f),
  };
}

/** The key a deck with no predicates was fetched under. */
export const UNFILTERED_DECK_KEY = "-";

/**
 * A stable identity for "which deck the server would return". The refetch
 * effect compares this, so it must move when — and only when — the server's
 * answer would. Coordinates are rounded to ~100 m so GPS jitter alone never
 * re-requests a deck.
 */
export function deckRequestKey(
  f: DiscoveryFilters,
  center: DeckCenter,
): string {
  if (!hasDiscoveryPredicates(f)) return UNFILTERED_DECK_KEY;
  const c = centerForRequest(f, center);
  const where = c ? `${c.lat.toFixed(3)},${c.lng.toFixed(3)}` : "";
  const when =
    f.when.mode === "at" ? `at:${f.when.day}:${f.when.hour}` : f.when.mode;
  return [
    f.context,
    [...f.familyKeys].sort().join("+"),
    [...f.categories].sort().join("+"),
    f.maxKm ?? "",
    when,
    where,
  ].join("|");
}
