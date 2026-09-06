// Map filters — Search only. The three Places sets + Super Category + How
// many cut the nearby catalog. There is no Types axis and no category
// slug list.
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
// A Super Category is a SET of categories; a category may sit in two
// (breakfast is restaurants AND cafés). The cut is OR: a place matches if
// any of its Super Categories is selected. Distance and time stay off
// this surface: the camera already bounds the set. Swipe keeps Discovery.

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
 * The stops, narrowest first, matching How many's small→large reading
 * order. `tick` is what the radio says; the names are Pato's own words,
 * and they fit because the legend stacks instead of sitting three-up.
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

/** Closest-N stops on Search Filters. Nothing in between. */
export const MAP_RESULT_LIMITS = [20, 40, 60] as const;
export type MapResultLimit = (typeof MAP_RESULT_LIMITS)[number];
/** How many is a CAP, so it opens at the smallest one (Pato, 2026-08-29). */
const MAP_RESULT_LIMIT_DEFAULT: MapResultLimit = 20;

export type MapFilters = {
  /** Which of the three nested sets. Default is the middle ring. */
  placesScope: MapPlacesScope;
  /** Super Category: the six place families; empty = no constraint. */
  familyKeys: FamilyKey[];
  /** Closest N after scope + Super. 20, 40, or 60. */
  resultLimit: MapResultLimit;
};

export const MAP_FILTER_DEFAULTS: MapFilters = {
  placesScope: MAP_PLACES_SCOPE_DEFAULT,
  familyKeys: [],
  resultLimit: MAP_RESULT_LIMIT_DEFAULT,
};

export function clampResultLimit(value: unknown): MapResultLimit {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return MAP_RESULT_LIMIT_DEFAULT;
  let best: MapResultLimit = MAP_RESULT_LIMIT_DEFAULT;
  let bestD = Number.POSITIVE_INFINITY;
  for (const stop of MAP_RESULT_LIMITS) {
    const d = Math.abs(stop - n);
    // Ties go up so 30 → 40 and 50 → 60, never a value between stops.
    if (d < bestD || (d === bestD && stop > best)) {
      best = stop;
      bestD = d;
    }
  }
  return best;
}

/**
 * Closest N after membership. Always distance-sorts, then slices. The cap
 * governs the MAP QUERY's set — the fetch already obeys it and this keeps
 * a stale mid-refetch catalog honest. It is NOT a carousel cap: an
 * anchored searchbar pick prepends AFTER it (MESITA-1405), so the guest
 * sees N unique when the pick is inside the N and N + 1 when outside.
 */
export function takeMapResultLimit<T extends { distance_km?: number | null }>(
  places: T[],
  limit: MapResultLimit,
): T[] {
  const cap = clampResultLimit(limit);
  const sorted = [...places].sort(
    (a, b) =>
      (a.distance_km ?? Number.POSITIVE_INFINITY) -
      (b.distance_km ?? Number.POSITIVE_INFINITY),
  );
  return sorted.length <= cap ? sorted : sorted.slice(0, cap);
}

/**
 * Absent, unknown, and legacy values all resolve to the middle ring —
 * never the narrowest. A persisted blob from before 2026-09-05 carries an
 * ordinal, and `1` meant "Mesita Places" there, so the numerics keep their
 * OLD meanings rather than being reinterpreted under the new law.
 * (The storage key is bumped too; this is the belt to that's braces.)
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

/** Leaving the default ring, each Super Category, or a How many stop, counts as one. */
export function mapFilterCount(f: MapFilters): number {
  const scope = f.placesScope === MAP_PLACES_SCOPE_DEFAULT ? 0 : 1;
  const howMany = f.resultLimit === MAP_RESULT_LIMIT_DEFAULT ? 0 : 1;
  return scope + f.familyKeys.length + howMany;
}

function matchesMapFilters(place: Place, f: MapFilters): boolean {
  const scope = placeSearchScope(place);
  if (!scope) return false;
  if (SCOPE_RANK[scope] > SCOPE_RANK[f.placesScope]) return false;

  // Super Category does not cut Google stubs — they have no reliable
  // Super Category cuts Mesita rows and Google stubs. Google membership
  // is the one Super of the Nearby primaryType (family_keys on the stub).
  if (f.familyKeys.length > 0) {
    const familyHit = f.familyKeys.some((key) =>
      (place.family_keys ?? []).includes(key),
    );
    if (!familyHit) return false;
  }

  return true;
}

/** Same-array passthrough when every row already matches, for memo stability. */
export function applyMapFilters(places: Place[], f: MapFilters): Place[] {
  const next = places.filter((place) => matchesMapFilters(place, f));
  return next.length === places.length ? places : next;
}
