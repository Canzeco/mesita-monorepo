// Discovery filter engine — the ONE place consumer surfaces narrow places.
// v4 (MESITA-1236) — FOUR predicates, Pato's order (Where · Distance · When ·
// What), behind the CONTEXT axis that cuts before all of them (MESITA-1081).
//
// RESTORED, DELIBERATELY MINUS ONE. The whole surface was deleted in
// MESITA-1183 alongside an admin config that really was dead — `filters_config`
// was NULL and read by nothing but its own two EFs. The GUEST control was
// collateral: it worked, and the teardown even left its server-side hook
// standing (`_shared/place-pool-shape.ts` still ships `family_keys` with "drop
// it and the filter silently matches nothing").
//
// The randomness knob did NOT come back. It was a 0..4 client-side deck
// reorder, and `randomness` is one of the seven named discovery signals
// (apps/web-admin/CLAUDE.md) — restoring it would mean tearing it out a second
// time when the engine lands. The server already shuffles (Fisher-Yates in
// consumer-web-recommend-swipe), so random lives in one place.
//
// THE RULE THAT MUST SURVIVE THE REBUILD: predicates CUT, signals RANK, and a
// predicate cuts first. No signal may resurrect a place a predicate excluded.
// A signal is a [0,1] score the guest never states; a filter is a boolean the
// guest just asserted. If the rebuild ever expresses "open now" as a soft
// signal scoring 0.0 rather than an exclusion, a hard filter and a soft signal
// will visibly disagree on the same deck — and the guest will believe the
// filter. Note which signals have no filter twin (popularity, semantic): that
// is the shape of the boundary, not an oversight.
//
//   · context    — what the guest wants to prioritize: any (no preference) ·
//                  visit (a body in the room) · order (remote). This mirrors
//                  Promos v11, where CONTEXT cuts before class × plan ever
//                  resolves (MESITA-1069) — so the sheet asks the same first
//                  question the bill engine does. `visit` narrows to places
//                  running a REAL visit reward (placeRewardsVisits, off the
//                  four per-class rate columns), which makes it a true
//                  predicate rather than a mood. `order` is PARKED and not
//                  selectable: no ticket carries a remote context yet, so
//                  nothing could back it. The sheet ships the pill visible but
//                  disabled + `soon` — the v11 precedent, "marked `soon`
//                  end-to-end rather than hidden; the structure ships first".
//
//   · zone       — a resolved CENTER the user searched for at ANY hierarchy
//                  level (address → street → neighborhood → city → county →
//                  state → country) OR their current location; `null` = current
//                  location / "here". Only lat/lng matter to the engine; `level`
//                  is a best-effort hint that seeds the default radius and feeds
//                  a future hierarchical picker (MESITA-672 "search now, levels
//                  later"). Picking a zone does NOT exclude anything on its own
//                  — it just recenters distances; the narrowing is the distance
//                  tolerance below.
//   · maxKm      — distance tolerance: radius in km around the zone center;
//                  `null` = any distance. Reads place.distance_km, which the
//                  host recomputes relative to the SAME center (withDistances),
//                  so "close cases only" vs "tolerate farther" is one knob.
//   · when       — now (open right now) · anytime (no time constraint) ·
//                  at{day,hour} (open at that place-local weekday + hour, e.g.
//                  "Saturday at noon"), using the SAME split-shift/overnight
//                  math as the detail modal (computeOpenState). No hours table
//                  = can't confirm open = excluded for now/at.
//   · what       — super-categories (place families) OR concrete category
//                  slugs; OR across the two tiers.
// The category option list still derives from the catalog the host is showing,
// so no category pick is a dead end. The zone, by contrast, is a free location
// search (any level), not catalog-derived.

import type { Place } from "@/lib/api/places";
import { computeOpenState } from "@/lib/adapters/place-to-detail-helpers";
import { resolvePlaceCategoryName } from "@/lib/place-category";
import { type FamilyKey } from "@/lib/place-families";
import { placeRewardsVisits } from "@/lib/promo-rates";

// ── Context (the promos-v11 CONTEXT axis) ───────────────────────────────────
/** What the guest wants to prioritize — the first cut, same as the bill. */
export type DiscoveryContext = "any" | "visit" | "order";

export const DISCOVERY_CONTEXTS = ["any", "visit", "order"] as const;

/**
 * Contexts the model knows but the guest cannot pick yet. `orders` is parked
 * end-to-end in promos v11 — the ladder and the knobs exist, but no ticket
 * carries a remote context, so nothing reads it.
 */
const DISCOVERY_CONTEXTS_SOON: readonly DiscoveryContext[] = ["order"];

export function discoveryContextIsSoon(context: DiscoveryContext): boolean {
  return DISCOVERY_CONTEXTS_SOON.includes(context);
}

/** Pill copy + the honest one-liner under the module. */
export const DISCOVERY_CONTEXT_META = {
  any: {
    label: "Any",
    caption: "No preference — everything your other filters leave standing.",
  },
  visit: {
    label: "Visit",
    caption: "Only places that reward you for showing up in person.",
  },
  order: {
    label: "Order",
    caption: "Ordering in lands when places start rewarding remote bills.",
  },
} as const satisfies Record<
  DiscoveryContext,
  { label: string; caption: string }
>;

/** Whether a context actually excludes places (only `visit` does today). */
function contextNarrows(context: DiscoveryContext): boolean {
  return context === "visit";
}

// ── Where / distance ────────────────────────────────────────────────────────
export const DISCOVERY_ZONE_LEVELS = [
  "address",
  "street",
  "neighborhood",
  "city",
  "county",
  "state",
  "country",
] as const;

export type DiscoveryZoneLevel = (typeof DISCOVERY_ZONE_LEVELS)[number];

/** A resolved geographic center for the Where filter (a searched location). */
export type DiscoveryZone = {
  /** Human label for the active pill, e.g. "Polanco, CDMX". */
  label: string;
  lat: number;
  lng: number;
  /** Best-effort hierarchy level of the pick (seeds the default radius). */
  level?: DiscoveryZoneLevel;
};

/** Distance-tolerance slider bounds, in km. */
export const DISTANCE_MIN_KM = 1;
export const DISTANCE_MAX_KM = 50;

/**
 * A sensible starting radius for a freshly-picked zone, by level — a street
 * wants a tight ring, a city a loose one; state/country/unknown default to "any
 * distance" (null) since no fixed radius bounds them.
 */
export function defaultRadiusForLevel(
  level: DiscoveryZoneLevel | undefined,
): number | null {
  switch (level) {
    case "address":
    case "street":
      return 2;
    case "neighborhood":
      return 5;
    case "city":
      return 15;
    case "county":
      return 30;
    default:
      return null;
  }
}

// ── When ────────────────────────────────────────────────────────────────────
export type DiscoveryWhen =
  | { mode: "now" }
  | { mode: "anytime" }
  // day 0=Sun..6=Sat (JS getDay order), hour 0..23, place-local.
  | { mode: "at"; day: number; hour: number };

/** Sunday-first weekday captions — matches JS getDay() / computeOpenState. */
export const WEEKDAY_LABELS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

/** "8:00 PM"-style label for a 0–23 hour. */
export function formatHourLabel(hour: number): string {
  const clamped = Math.min(23, Math.max(0, Math.round(hour)));
  const suffix = clamped < 12 ? "AM" : "PM";
  const base = clamped % 12 === 0 ? 12 : clamped % 12;
  return `${base}:00 ${suffix}`;
}

// ── Filter state ────────────────────────────────────────────────────────────
export type DiscoveryFilters = {
  /** What to prioritize — any · visit · order (order parked, unselectable). */
  context: DiscoveryContext;
  /** Super-categories: multi-select place families; empty = no constraint. */
  familyKeys: FamilyKey[];
  /** Concrete category slugs; ORed with familyKeys. Empty = no constraint. */
  categories: string[];
  /** Searched center; null = current location / here. */
  zone: DiscoveryZone | null;
  /** Distance tolerance in km (radius from the center); null = any distance. */
  maxKm: number | null;
  /** When to go — now / anytime / a specific weekday + hour. */
  when: DiscoveryWhen;
  // That — the intent's 4th axis — lives with Memo, which carries the ask
  // through its own recall call. It is NOT a consumer filter control: the
  // sheet shipped one in MESITA-699 but never sent it anywhere, so it's gone.
};

export const DISCOVERY_FILTER_DEFAULTS: DiscoveryFilters = {
  // Any = neutral: the sheet never opens already committed to a context.
  context: "any",
  familyKeys: [],
  categories: [],
  zone: null,
  maxKm: null,
  // Anytime = neutral: the sheet opens on the full catalog. Now / At are opt-in
  // narrowings, so a fresh sheet never hides everything behind a time filter.
  when: { mode: "anytime" },
};

/**
 * The *narrowing* predicates — the fields that actually drop the visible count.
 * A zone alone only recenters distances (no exclusion), so it is excluded
 * here. This is the exact set
 * applyDiscoveryFilters gates on, and the sheet's empty-state copy keys off it:
 * predicates set → "no matches, reset"; none set → the host is simply empty and
 * Reset can't help (MESITA-670).
 */
export function hasDiscoveryPredicates(f: DiscoveryFilters): boolean {
  return (
    contextNarrows(f.context) ||
    f.familyKeys.length > 0 ||
    f.categories.length > 0 ||
    f.maxKm !== null ||
    f.when.mode !== "anytime"
  );
}

/** Any deviation from defaults — drives the red trigger dot (MESITA-633). */
export function discoveryFiltersAreActive(f: DiscoveryFilters): boolean {
  return hasDiscoveryPredicates(f) || f.zone !== null;
}

function matchesDiscoveryFilters(place: Place, f: DiscoveryFilters): boolean {
  // Context cuts FIRST — the same order the bill engine runs (promos v11). A
  // guest prioritizing a visit only wants places that actually pay for one.
  // `order` never reaches here (the pill is disabled and the store refuses it);
  // if a stale session still carries it, it narrows nothing rather than
  // inventing a remote catalog we don't have.
  if (f.context === "visit" && !placeRewardsVisits(place)) return false;

  // What — OR across the two tiers.
  if (f.familyKeys.length > 0 || f.categories.length > 0) {
    const categoryHit =
      f.categories.length > 0 &&
      place.category != null &&
      f.categories.includes(place.category);
    const familyHit =
      f.familyKeys.length > 0 &&
      f.familyKeys.some((key) => (place.family_keys ?? []).includes(key));
    if (!categoryHit && !familyHit) return false;
  }

  // Distance tolerance — radius (km) around the chosen zone center. The host
  // computes distance_km relative to that SAME center (searched location or the
  // device's location). distance_km 0 is the "couldn't calculate" placeholder
  // (real readings floor at 0.1), so unknown distances honestly fail a radius.
  if (f.maxKm !== null) {
    const d = place.distance_km;
    if (typeof d !== "number" || d < 0.1 || d > f.maxKm) return false;
  }

  // When — open at the requested place-local moment. Anytime = no constraint;
  // Now = the current moment; At = a specific weekday + hour. No hours table =
  // can't confirm open = excluded (same as the old hour filter).
  if (f.when.mode !== "anytime") {
    const hours = place.hours;
    const hasHours =
      !!hours &&
      typeof hours === "object" &&
      !Array.isArray(hours) &&
      Object.keys(hours as object).length > 0;
    if (!hasHours) return false;
    const tz = place.timezone ?? undefined;
    const open =
      f.when.mode === "at"
        ? computeOpenState(hours, tz, f.when.hour * 60, f.when.day).open_now
        : computeOpenState(hours, tz).open_now;
    if (!open) return false;
  }

  return true;
}

/** Returns the SAME array when no predicate is set, for memo stability. */
export function applyDiscoveryFilters(
  places: Place[],
  f: DiscoveryFilters,
): Place[] {
  if (!hasDiscoveryPredicates(f)) return places;
  return places.filter((place) => matchesDiscoveryFilters(place, f));
}

// ── What options (catalog-derived) ──────────────────────────────────────────
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
