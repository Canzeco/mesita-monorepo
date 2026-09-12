// Map filters — Search only. Super Category + Places scope + Popularity
// (Google review-count floor). How many is operator `map.pinCount`.
//
// THREE NESTED SETS (Pato, 2026-09-05):
//
//   Google Places  ⊃  Mesita Enriched Places  ⊃  Mesita Partner Places
//      gray                    red                      yellow
//
// A superset chain, not overlapping circles — so the control is a
// cumulative ladder and the figure is concentric rings. ENRICHMENT GATES
// EVERY MESITA RING: a partner has to be enriched to sit inside the
// enriched one, so an unenriched partner is in neither ring and reads
// gray. Created and Requested stubs were never a search source. Default
// is Mesita Enriched Places, the middle ring — a discovery surface must
// never open on "only the places that pay us".
//
// Popularity is a Discovery-mode artificial filter (Pato, 2026-09-12):
// the Map mode drops rows whose Google review count is below the stop
// AFTER the catalog is assembled, never as a Google Nearby API param.
// Stops: 0 / 10 / 100 / 1000 / 10000. Default 0 = no extra guest cut;
// operator floors still bind underneath.
//
// The SERVER is the one selector (MESITA-1699 law kept): SearchClient
// posts these three params and paints what comes back. applyMapFilters
// here is the nested-set law the sheet counts against, not a second cut.
// Distance and time stay off this surface: the camera already bounds
// the set. Swipe keeps DiscoveryFilters.

import type { Place } from "@/lib/api/places";
import { type FamilyKey } from "@/lib/place-families";

export type MapStateKey =
  | "not_on_mesita"
  | "created"
  | "requested"
  | "enriched"
  | "partnered"
  | "promoted";

/** The set the guest picked. Named, never an ordinal — the wire carries
 *  this word, and two callers post no scope at all. */
export type MapPlacesScope = "partners" | "mesita" | "google";

/** The middle ring. A discovery surface never opens on the paid-only set. */
export const MAP_PLACES_SCOPE_DEFAULT: MapPlacesScope = "mesita";

/** Rank inside the chain — bigger ring, bigger number. Not a wire value. */
const SCOPE_RANK: Record<MapPlacesScope, number> = {
  partners: 1,
  mesita: 2,
  google: 3,
};

/**
 * The stops, narrowest first. `tick` is what the radio says; the names
 * are Pato's own words, and they fit because the legend stacks instead of
 * sitting three-up.
 */
export const MAP_SEARCH_STOPS = [
  {
    key: "partners",
    tick: "Mesita Partner Places",
    label: "Mesita Partner Places",
    hint: "Mesita Partner Places only",
  },
  {
    key: "mesita",
    tick: "Mesita Enriched Places",
    label: "Mesita Enriched Places",
    hint: "Mesita Enriched Places, partners included",
  },
  {
    key: "google",
    tick: "Google Places",
    label: "Google Places",
    hint: "Google Places, Mesita places included",
  },
] as const satisfies readonly {
  key: MapPlacesScope;
  tick: string;
  label: string;
  hint: string;
}[];

/** Google review-count floor. Mirror `_shared/map-engine.ts`. */
export const MAP_MIN_REVIEW_STOPS = [0, 10, 100, 1000, 10000] as const;
export type MapMinReviews = (typeof MAP_MIN_REVIEW_STOPS)[number];
const MAP_MIN_REVIEWS_DEFAULT: MapMinReviews = 0;

export type MapFilters = {
  /** Which of the three nested sets. Default is the middle ring. */
  placesScope: MapPlacesScope;
  /** Super Category: the seven real place families; empty = no constraint. */
  familyKeys: FamilyKey[];
  /** Minimum Google reviews. 0 = any. */
  minReviews: MapMinReviews;
};

export const MAP_FILTER_DEFAULTS: MapFilters = {
  placesScope: MAP_PLACES_SCOPE_DEFAULT,
  familyKeys: [],
  minReviews: MAP_MIN_REVIEWS_DEFAULT,
};

export function clampMinReviews(value: unknown): MapMinReviews {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return MAP_MIN_REVIEWS_DEFAULT;
  let best: MapMinReviews = MAP_MIN_REVIEW_STOPS[MAP_MIN_REVIEW_STOPS.length - 1];
  let bestD = Number.POSITIVE_INFINITY;
  for (const stop of MAP_MIN_REVIEW_STOPS) {
    const d = Math.abs(stop - n);
    if (d < bestD || (d === bestD && stop > best)) {
      best = stop;
      bestD = d;
    }
  }
  return best;
}

/**
 * Absent, unknown, and legacy values all resolve to the middle ring —
 * never the narrowest. A persisted blob from before 2026-09-05 carries an
 * ordinal, and `1` meant "Mesita Places" there, so the numerics keep their
 * OLD meanings rather than being reinterpreted under the new law.
 */
export function parsePlacesScope(value: unknown): MapPlacesScope {
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    if (key === "partners" || key === "mesita" || key === "google") return key;
    const legacy = Number(key);
    if (key.length > 0 && Number.isFinite(legacy)) {
      return legacy >= 2 ? "google" : MAP_PLACES_SCOPE_DEFAULT;
    }
    return MAP_PLACES_SCOPE_DEFAULT;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 2 ? "google" : MAP_PLACES_SCOPE_DEFAULT;
  }
  return MAP_PLACES_SCOPE_DEFAULT;
}

export function placesScopeCaption(scope: MapPlacesScope): string {
  return MAP_SEARCH_STOPS.find((stop) => stop.key === scope)?.hint ??
    MAP_SEARCH_STOPS[1].hint;
}

/** Highest rung wins so a place has one atlas state. */
export function placeMapState(place: Place): MapStateKey {
  if (place.googleOnly || place.from_google) return "not_on_mesita";
  if (place.promoting === true) return "promoted";
  if (place.partner === true) return "partnered";
  if (place.content_state === "ready" || Boolean(place.enriched_at)) {
    return "enriched";
  }
  const requests = Number(place.request_count);
  if (Number.isFinite(requests) && requests > 0) return "requested";
  return "created";
}

/**
 * The narrowest ring a place belongs to. Created and Requested return null
 * — every Mesita ring is enriched-only, never a thin stub, and that is
 * what makes Partner ⊂ Enriched true rather than merely drawn.
 *
 * Partner membership reads `place.partner`, the server's boolean, NOT
 * `placeMapState`'s rung order: `promoted` outranks `partnered` there, so
 * a promoting non-partner would otherwise be client-side partner and
 * server-side not, and would flicker depending on which cut ran last.
 */
export function placeSearchScope(place: Place): MapPlacesScope | null {
  if (place.googleOnly || place.from_google) return "google";
  const enriched = place.content_state === "ready" || Boolean(place.enriched_at);
  if (!enriched) return null;
  return place.partner === true ? "partners" : "mesita";
}

export function mapFiltersAreActive(f: MapFilters): boolean {
  return mapFilterCount(f) > 0;
}

/** Leaving the default ring, each Super Category, or a Popularity stop, counts as one. */
export function mapFilterCount(f: MapFilters): number {
  const scope = f.placesScope === MAP_PLACES_SCOPE_DEFAULT ? 0 : 1;
  const popularity = f.minReviews === MAP_MIN_REVIEWS_DEFAULT ? 0 : 1;
  return scope + f.familyKeys.length + popularity;
}

function matchesMapFilters(place: Place, f: MapFilters): boolean {
  const scope = placeSearchScope(place);
  if (!scope) return false;
  if (SCOPE_RANK[scope] > SCOPE_RANK[f.placesScope]) return false;

  if (f.familyKeys.length > 0) {
    const familyHit = f.familyKeys.some((key) =>
      (place.family_keys ?? []).includes(key),
    );
    if (!familyHit) return false;
  }

  return true;
}

/** Nested-set + Super Category law. Popularity is the EF's, not this cut. */
export function applyMapFilters(places: Place[], f: MapFilters): Place[] {
  const next = places.filter((place) => matchesMapFilters(place, f));
  return next.length === places.length ? places : next;
}
