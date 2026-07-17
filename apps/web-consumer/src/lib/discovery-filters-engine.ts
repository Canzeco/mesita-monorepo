// Discovery filter engine — the ONE place consumer surfaces narrow places
// (MESITA-646, the simplification of MESITA-632's presentational sheet).
//
// Pure predicates over fields already on the public places projection:
//   · family   — places.category rolled up via familyKeysOfCategory
//   · zone     — the literal places.zone string ("Near me" = null = no
//                constraint; ranking is already distance-aware, so this is
//                deliberately NOT a geolocation feature)
//   · open now — the enrichPlaceOverview-derived open_now; places without an
//                hours table don't qualify (an "Open now" filter that guesses
//                is worse than a smaller honest result set)
// `surprise` is NOT a predicate — it's a deck-ordering concept only the Swipe
// host applies (shuffle instead of ranked order); the map ignores it.

import type { Place } from "@/lib/api/places";
import { familyKeysOfCategory, type FamilyKey } from "@/lib/place-families";

export type DiscoveryFilters = {
  /** Multi-select place families; empty = every family. */
  familyKeys: FamilyKey[];
  /** Selected places.zone value; null = "Near me" (no zone constraint). */
  zone: string | null;
  /** Only places whose hours say they're open right now. */
  openNow: boolean;
  /** Swipe only: shuffle the deck instead of the ranked order. */
  surprise: boolean;
};

export const DISCOVERY_FILTER_DEFAULTS: DiscoveryFilters = {
  familyKeys: [],
  zone: null,
  openNow: false,
  surprise: false,
};

/** Any deviation from defaults — drives the red trigger dot (MESITA-633). */
export function discoveryFiltersAreActive(f: DiscoveryFilters): boolean {
  return f.familyKeys.length > 0 || f.zone !== null || f.openNow || f.surprise;
}

export function matchesDiscoveryFilters(
  place: Place,
  f: DiscoveryFilters,
): boolean {
  if (f.familyKeys.length > 0) {
    const families = familyKeysOfCategory(place.category);
    if (!families.some((key) => f.familyKeys.includes(key))) return false;
  }
  if (f.zone !== null && place.zone !== f.zone) return false;
  if (f.openNow && place.open_now !== true) return false;
  return true;
}

/** Returns the SAME array when no predicate is set, for memo stability. */
export function applyDiscoveryFilters(
  places: Place[],
  f: DiscoveryFilters,
): Place[] {
  const hasPredicates = f.familyKeys.length > 0 || f.zone !== null || f.openNow;
  if (!hasPredicates) return places;
  return places.filter((place) => matchesDiscoveryFilters(place, f));
}

/**
 * Zone options come from the catalog the host is actually showing — never a
 * hand-written geography — so no pick can be a dead end and the row grows on
 * its own when the catalog spans new zones. Most-populated first.
 */
export function deriveZones(places: Place[], cap = 10): string[] {
  const counts = new Map<string, number>();
  for (const place of places) {
    const zone = typeof place.zone === "string" ? place.zone.trim() : "";
    if (!zone) continue;
    counts.set(zone, (counts.get(zone) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, cap)
    .map(([zone]) => zone);
}
