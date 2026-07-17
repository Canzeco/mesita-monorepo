// Discovery filter engine — the ONE place consumer surfaces narrow places
// (MESITA-646 flat sheet → MESITA-650 two-tier model).
//
// Pure predicates over fields already on the public places projection:
//   · what  — super-categories (place families via familyKeysOfCategory) OR
//             concrete category slugs; OR across the two tiers, so picking
//             "Bars & Nightlife" + "Fine Dining" means either matches
//   · where — a zone (places.zone) OR its super-zone city (places.city, read
//             off the raw row) OR "Here" = no geo constraint, optionally
//             tightened by a distance tolerance over the computed distance_km
//   · when  — null = Now (neutral, no constraint) or a 0–23 place-local hour:
//             "open at that hour today", using the SAME split-shift/overnight
//             math as the detail modal (computeOpenState with atMinutes)
// `randomness` (0–3) is NOT a predicate — it's a deck-ordering level only the
// Swipe host applies (orderByRandomness); the map ignores it.
//
// Every option list (cities, zones, categories) derives from the catalog the
// host is actually showing — never a hand-written geography or taxonomy — so
// no pick can be a dead end and the sheet grows with the catalog.

import type { Place } from "@/lib/api/places";
import { computeOpenState } from "@/lib/adapters/place-to-detail-helpers";
import { resolvePlaceCategoryName } from "@/lib/place-category";
import { familyKeysOfCategory, type FamilyKey } from "@/lib/place-families";

export type RandomnessLevel = 0 | 1 | 2 | 3;

export type DiscoveryFilters = {
  /** Super-categories: multi-select place families; empty = no constraint. */
  familyKeys: FamilyKey[];
  /** Concrete category slugs; ORed with familyKeys. Empty = no constraint. */
  categories: string[];
  /** Super-zone (places.city). Ignored while a zone is set. */
  city: string | null;
  /** places.zone; selecting one implies its city. */
  zone: string | null;
  /** "Here" distance tolerance in km; null = any distance. */
  maxKm: number | null;
  /** 0–23 place-local hour; null = Now (no time constraint). */
  hour: number | null;
  /** Deck ordering: 0 ranked · 1 mild · 2 adventurous · 3 full surprise. */
  randomness: RandomnessLevel;
};

export const DISCOVERY_FILTER_DEFAULTS: DiscoveryFilters = {
  familyKeys: [],
  categories: [],
  city: null,
  zone: null,
  maxKm: null,
  hour: null,
  randomness: 0,
};

export const DISTANCE_STEPS_KM = [1, 3, 5, 10] as const;

export const RANDOMNESS_LABELS: Record<RandomnessLevel, string> = {
  0: "Ranked",
  1: "Mild",
  2: "Adventurous",
  3: "Surprise",
};

/** Any deviation from defaults — drives the red trigger dot (MESITA-633). */
export function discoveryFiltersAreActive(f: DiscoveryFilters): boolean {
  return (
    f.familyKeys.length > 0 ||
    f.categories.length > 0 ||
    f.city !== null ||
    f.zone !== null ||
    f.maxKm !== null ||
    f.hour !== null ||
    f.randomness !== 0
  );
}

/** places.city rides on the raw row (PLACE_PUBLIC_COLUMNS) but not the type. */
export function placeCity(place: Place): string | null {
  const city = (place as unknown as Record<string, unknown>).city;
  return typeof city === "string" && city.trim() ? city : null;
}

export function matchesDiscoveryFilters(
  place: Place,
  f: DiscoveryFilters,
): boolean {
  // What — OR across the two tiers.
  if (f.familyKeys.length > 0 || f.categories.length > 0) {
    const categoryHit =
      f.categories.length > 0 &&
      place.category != null &&
      f.categories.includes(place.category);
    const familyHit =
      f.familyKeys.length > 0 &&
      familyKeysOfCategory(place.category).some((key) =>
        f.familyKeys.includes(key),
      );
    if (!categoryHit && !familyHit) return false;
  }

  // Where — zone beats city beats the Here distance tolerance.
  if (f.zone !== null) {
    if (place.zone !== f.zone) return false;
  } else if (f.city !== null) {
    if (placeCity(place) !== f.city) return false;
  } else if (f.maxKm !== null) {
    // distance_km 0 is the "couldn't calculate" placeholder (real readings
    // floor at 0.1) — unknown distances honestly fail a tolerance filter.
    const d = place.distance_km;
    if (typeof d !== "number" || d < 0.1 || d > f.maxKm) return false;
  }

  // When — open at the parked place-local hour; no hours table = no match.
  if (f.hour !== null) {
    const row = place as unknown as Record<string, unknown>;
    const hours = row.hours;
    const hasHours =
      !!hours &&
      typeof hours === "object" &&
      !Array.isArray(hours) &&
      Object.keys(hours as object).length > 0;
    if (!hasHours) return false;
    const tz = typeof row.timezone === "string" ? row.timezone : undefined;
    if (!computeOpenState(hours, tz, f.hour * 60).open_now) return false;
  }

  return true;
}

/** Returns the SAME array when no predicate is set, for memo stability. */
export function applyDiscoveryFilters(
  places: Place[],
  f: DiscoveryFilters,
): Place[] {
  const hasPredicates =
    f.familyKeys.length > 0 ||
    f.categories.length > 0 ||
    f.city !== null ||
    f.zone !== null ||
    f.maxKm !== null ||
    f.hour !== null;
  if (!hasPredicates) return places;
  return places.filter((place) => matchesDiscoveryFilters(place, f));
}

export type WhereOption = { city: string; zones: string[] };

/**
 * Super-zones (cities) with their zones, from the loaded catalog — most
 * places first at both tiers.
 */
export function deriveWhereOptions(
  places: Place[],
  cityCap = 6,
  zoneCap = 10,
): WhereOption[] {
  const cities = new Map<string, { n: number; zones: Map<string, number> }>();
  for (const place of places) {
    const city = placeCity(place);
    if (!city) continue;
    const entry = cities.get(city) ?? { n: 0, zones: new Map() };
    entry.n += 1;
    const zone = typeof place.zone === "string" ? place.zone.trim() : "";
    if (zone) entry.zones.set(zone, (entry.zones.get(zone) ?? 0) + 1);
    cities.set(city, entry);
  }
  return [...cities.entries()]
    .sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))
    .slice(0, cityCap)
    .map(([city, entry]) => ({
      city,
      zones: [...entry.zones.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, zoneCap)
        .map(([zone]) => zone),
    }));
}

export type CategoryOption = { slug: string; label: string };

/** Concrete categories present in the catalog, most places first. */
export function deriveCategoryOptions(
  places: Place[],
  cap = 12,
): CategoryOption[] {
  const counts = new Map<string, { n: number; label: string }>();
  for (const place of places) {
    const slug = place.category?.trim();
    if (!slug) continue;
    const entry = counts.get(slug);
    if (entry) {
      entry.n += 1;
      continue;
    }
    const label =
      resolvePlaceCategoryName({
        categoryLabel: place.category_label,
        category: slug,
      }) ?? slug;
    counts.set(slug, { n: 1, label });
  }
  return [...counts.entries()]
    .sort((a, b) => b[1].n - a[1].n || a[1].label.localeCompare(b[1].label))
    .slice(0, cap)
    .map(([slug, { label }]) => ({ slug, label }));
}

/**
 * Deck ordering for the randomness level: 0 keeps the ranked order, 3 is a
 * full shuffle, 1–2 jitter each card around its rank (a card can drift ~k
 * positions), so exploration scales without discarding ranking entirely.
 */
export function orderByRandomness(
  places: Place[],
  level: RandomnessLevel,
): Place[] {
  if (level === 0 || places.length < 2) return places;
  if (level >= 3) {
    const out = [...places];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  const k = level === 1 ? 3 : 10;
  return places
    .map((place, i) => ({ place, key: i + Math.random() * k }))
    .sort((a, b) => a.key - b.key)
    .map(({ place }) => place);
}
