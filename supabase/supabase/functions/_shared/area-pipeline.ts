// THE AREA PIPELINE (MESITA-2302, one pool since MESITA-2379, four sources
// since MESITA-2703). Places around a POINT and a RADIUS — the Map's cross
// and its screen radius, or Home's device / saved pin and its radius — or,
// with no point, Mesita's own places by Popularity alone. Home (the Feed)
// and the Map are VIEWS of Area; they share this one retrieval, the same
// switches and the same ranking (Pato, MESITA-2703: "get (geolocation,
// radius), pull from four sources, merge duplicates, sort").
//
//   (point, radius)
//     ├─ Google Popularity   Nearby, rank POPULARITY, the whole circle  ─┐
//     ├─ Google Proximity   Nearby, rank DISTANCE, the whole circle    ─┤ → owned lookup by Place ID
//     ├─ Mesita Popularity   top 20 by Popularity × s in the circle     ─┤
//     └─ Mesita Proximity   20 nearest in the circle                   ─┘
//   merge (one card per place; an owned hit is the Mesita row; `foundBy`
//   keeps every source that found it) → gates → Proximity × Popularity
//   × s (s = the Selected boost for a Mesita Selected place, else 1)
//
// Each source is `map.<key>` 0 or 20 (`AREA_SOURCE_KEYS`). Gates: Family ·
// Radius, plus the operational ones the sources apply (active, ready) and
// the Popularity floor; no reviews floor (MESITA-2721). Score:
// area-score.ts; Proximity is ½ at the radius ÷ the operator's
// Distance penalty (MESITA-2720): `params.proximity.radiusDivisor`, one
// number for the Map, Home and Chat (MESITA-2776 retired MESITA-2727's
// separate Catalog penalty).
//
// Fail closed on money: no key, no point, no types, a quota refusal or a
// Google error buy nothing; an owned-lookup error drops the Google side (no
// stub may shadow a Mesita place). No photo field is ever asked for a
// Google-only card, nothing here writes a row, and no Google answer outlives
// its request: nothing caches one (Google Maps Platform terms; MESITA-2765).
//
// Chat (MESITA-2339) does not use the pool: `areaSelectedPlaces` reads Mesita
// Selected places only, with the same score inside `map.radiusKm`.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { EVERY_FAMILY_TYPES, nearbyTypesForSupers } from "./google-type-super.ts";
import { isSelectedRow } from "./selected-row.ts";
import { googleStub } from "./google-stub.ts";
import { applyBboxPredicate, type BboxQuery, haversineKm, nearbyBbox } from "./geo.ts";
import {
  applyGeneralGateQuery,
  clearsGeneralGate,
  type FilterableQuery,
} from "./discovery-general-gate.ts";
import { familiesForPlace } from "./place-taxonomy.ts";
import {
  nearbyExcludedTypesForFamilies,
  placeFamilies,
  primaryFamilyForGoogleType,
} from "./sourcing.ts";
import {
  type AreaBounds,
  type AreaCandidate,
  type AreaContext,
  type AreaDiagnostics,
  type AreaLocation,
  type AreaSource,
  insideBounds,
  knownFamilies,
  type LatLng,
  popularPart,
  rankArea,
} from "./area-score.ts";
import { logPopularity, PROXIMITY_RADIUS_DIVISOR_DEFAULT } from "./pipeline-signals.ts";
import {
  AREA_SOURCE_KEYS,
  type AreaSourceKey,
  type DiscoveryConfig,
  MAP_RADIUS_KM_MAX,
  MAP_RADIUS_KM_MIN,
  type GeneralConfig,
  type SignalParams,
} from "./discovery-config.ts";
import {
  type NearbyHit,
  type NearbyOutcome,
  type NearbyRank,
  searchNearbyPlacesOutcome,
} from "./nearby-places.ts";

/** Every guest family's Nearby types (round-robin, capped at 50): what a
 *  view with no family requested asks Google for. */
export const FEED_GOOGLE_TYPES: readonly string[] = EVERY_FAMILY_TYPES;

/**
 * The Nearby types a request sends (MESITA-2438): the requested families'
 * own batteries, so a family row asks Google for THAT family's full type
 * list; none requested = every family's. Before this, the Feed always sent
 * the mixed every-family list and cut a family out of that one answer in
 * the browser, so a family row showed whatever survived a 20-place mix.
 */
export function areaGoogleTypes(families: readonly string[]): readonly string[] {
  return families.length > 0 ? nearbyTypesForSupers(families) : FEED_GOOGLE_TYPES;
}

/** Which surface asks: the Map (Search tab) or Home's catalog. The one
 *  number that differs is Places shown (MESITA-2727); the Distance penalty
 *  is shared since MESITA-2776. */
export type AreaSurface = "map" | "catalog";

/** Proximity's radius divisor (the Distance penalty), the
 *  Popularity floor and the Selected boost, from the blob: the one score every Area caller ranks by,
 *  Proximity × Popularity × the boost (no exponents since MESITA-2722). The radius is the request's: it
 *  gates, and ÷ the divisor it is the half distance (MESITA-2720).
 *  Popularity takes no parameter (MESITA-2710: ln(1 + reviews × stars)). */
export function areaSignalParams(
  params: SignalParams,
  map: {
    popularityFloor?: number;
    selectedFactor?: number;
  },
): Pick<AreaContext, "radiusDivisor" | "popularityFloor" | "selectedFactor"> {
  const k = params.proximity?.radiusDivisor;
  return {
    radiusDivisor: typeof k === "number" && Number.isFinite(k) && k > 0 ? k : PROXIMITY_RADIUS_DIVISOR_DEFAULT,
    // The Popularity floor (MESITA-2714), a gate on every Area caller.
    popularityFloor: map.popularityFloor,
    // The Selected boost (MESITA-2717), a multiplier on every Area caller.
    selectedFactor: map.selectedFactor,
  };
}

/** A Mesita row that may own a hit: active, ready, with its google id. */
export type OwnedRow = Record<string, unknown> & {
  id: string;
  google_place_id?: string | null;
  lat?: number | null;
  lng?: number | null;
};

const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Mesita Selected (the operator's mark, `places.selected`, MESITA-2707) or
 *  merely a ready Mesita row. Never read off `enriched_at`: Selected and
 *  Enriched are independent facts. */
function mesitaSource(row: Record<string, unknown>): AreaSource {
  return isSelectedRow(row as { selected?: boolean | null }) ? "selected" : "mesita";
}

/**
 * A Mesita row's primary family (MESITA-2438): its category's (the Google
 * `primaryType` Mesita stores) when that family is one of the row's own,
 * else the row's first known family; null when it has none.
 */
export function mesitaPrimaryFamily(row: Record<string, unknown>): string | null {
  const keys = knownFamilies(familiesForPlace(row));
  const fromCategory = primaryFamilyForGoogleType(
    typeof row.category === "string" ? row.category : null,
  );
  if (fromCategory && keys.includes(fromCategory)) return fromCategory;
  return keys[0] ?? null;
}

/** A Mesita row as an Area candidate (no Google hit behind it). */
export function mesitaCandidate(row: Record<string, unknown>): AreaCandidate {
  return {
    id: String(row.id ?? ""),
    lat: numOrNull(row.lat),
    lng: numOrNull(row.lng),
    rating: numOrNull(row.google_stars_overall),
    reviewCount: numOrNull(row.google_review_count),
    familyKeys: familiesForPlace(row),
    source: mesitaSource(row),
    ready: 1,
    reviews: null,
    spotlightTier: numOrNull(row.spotlight_tier) ?? 0,
  };
}

/**
 * A Google hit Mesita owns, as an Area candidate (MESITA-2338). It is the
 * same Google listing, so its rating and review count come from the hit —
 * the numbers eligibility already judged — and fall back to the stored ones
 * only when the hit lacks them. Its families are Mesita's own; only when
 * Mesita does not know them does the type Google returned it for decide.
 */
export function ownedCandidate(row: Record<string, unknown>, hit: NearbyHit): AreaCandidate {
  const base = mesitaCandidate(row);
  const known = knownFamilies(base.familyKeys);
  return {
    ...base,
    rating: numOrNull(hit.rating) ?? base.rating,
    reviewCount: numOrNull(hit.reviewCount) ?? base.reviewCount,
    familyKeys: known.length > 0 ? base.familyKeys : placeFamilies(hit.primaryType, hit.types).keys,
    reviews: 1,
  };
}

function stubCandidate(stub: Record<string, unknown>, hit: NearbyHit): AreaCandidate {
  return {
    id: String(stub.id),
    lat: hit.lat,
    lng: hit.lng,
    rating: hit.rating,
    reviewCount: hit.reviewCount,
    familyKeys: (stub.family_keys as string[] | undefined) ?? [],
    source: "google",
    ready: null,
    reviews: 1,
  };
}

// ── Locations ───────────────────────────────────────────────────────────

/** A visible map wider than this (diagonal, km) has no screen radius: the
 *  Map falls back to the operator's `map.radiusKm` around its cross. */
export const AREA_BOUNDS_MAX_KM = 100;

function latLngOrNull(raw: unknown): LatLng | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const lat = numOrNull(o.lat);
  const lng = numOrNull(o.lng);
  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** The Map's visible `bounds`, or null when absent, inverted or too wide. */
export function parseAreaBounds(raw: unknown): AreaBounds | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const low = latLngOrNull(o.low);
  const high = latLngOrNull(o.high);
  if (!low || !high) return null;
  if (!(low.lat < high.lat) || !(low.lng < high.lng)) return null;
  const diag = haversineKm(low.lat, low.lng, high.lat, high.lng);
  if (!Number.isFinite(diag) || diag > AREA_BOUNDS_MAX_KM) return null;
  return { low, high };
}

/**
 * Home's radius (MESITA-2703): the saved pin's own `radiusKm` when the
 * client sends a finite one, clamped to `MAP_RADIUS_KM_MIN`..`MAX`; anything
 * else (missing, a string, NaN) is the operator's `map.radiusKm`, the
 * current-location radius. `from` goes in the log line.
 */
export function requestRadiusKm(
  raw: unknown,
  operatorKm: number,
): { km: number; from: "request" | "operator" } {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return { km: operatorKm, from: "operator" };
  const km = Math.round(Math.min(MAP_RADIUS_KM_MAX, Math.max(MAP_RADIUS_KM_MIN, raw)) * 10) / 10;
  return { km, from: "request" };
}

/** A centre makes a point inside the radius; no centre, no location. */
export function resolveAreaLocation(
  center: LatLng | null,
  radiusKm: number,
): AreaLocation {
  if (center) return { kind: "point", anchor: center, radiusKm };
  return { kind: "none" };
}

/** The screen radius's bounds (km): Google's Nearby circle cap on top. */
export const SCREEN_RADIUS_KM_MIN = 0.05;
export const SCREEN_RADIUS_KM_MAX = 50;

/**
 * THE SCREEN RADIUS (MESITA-2504): the distance from the cross to the
 * NEAREST edge of the visible map, in km, so the circle always fits on the
 * screen whatever its shape (Pato, MESITA-2511: "the radiopus muse be same
 * size of the smaller radious … horizontal is usually smaller, but not
 * always"). Measured from the cross itself — it sits 45% down, not in the
 * middle — and from the box's middle when the cross is missing or off the
 * box. It was half the width (MESITA-2507), and before that the average of
 * the half-width and half-height. Clamped to SCREEN_RADIUS_KM_MIN..MAX. Null
 * when the bounds are missing, inverted or wider than AREA_BOUNDS_MAX_KM
 * (the caller falls back to its operator radius).
 */
export function screenRadiusKm(raw: unknown, cross?: LatLng | null): number | null {
  const b = parseAreaBounds(raw);
  if (!b) return null;
  const inside = cross && insideBounds(cross, b);
  const c = inside ? cross : mid(b.low, b.high);
  const r = Math.min(
    haversineKm(c.lat, c.lng, c.lat, b.low.lng),
    haversineKm(c.lat, c.lng, c.lat, b.high.lng),
    haversineKm(c.lat, c.lng, b.low.lat, c.lng),
    haversineKm(c.lat, c.lng, b.high.lat, c.lng),
  );
  if (!Number.isFinite(r)) return null;
  return Math.min(SCREEN_RADIUS_KM_MAX, Math.max(SCREEN_RADIUS_KM_MIN, r));
}

/** The server's snap of a point centre (~110 m) for retrieval: Google is
 *  asked about the snapped point, never the guest's exact one; Proximity
 *  reads the raw centre. */
export function snapCenter(c: LatLng): LatLng {
  return { lat: Math.round(c.lat * 1000) / 1000, lng: Math.round(c.lng * 1000) / 1000 };
}

function mid(a: LatLng, b: LatLng): LatLng {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

/** The Google sources and the Nearby rank each asks for (MESITA-2703). Both
 *  search the whole circle; the rank is the only difference. */
export const GOOGLE_SOURCE_RANK: Readonly<Record<"googlePopular" | "googleClosest", NearbyRank>> = {
  googlePopular: "POPULARITY",
  googleClosest: "DISTANCE",
};

/** The switches that are on, in `AREA_SOURCE_KEYS` order. */
export function areaSourcesOn(
  map: Pick<DiscoveryConfig["map"], AreaSourceKey>,
): AreaSourceKey[] {
  return AREA_SOURCE_KEYS.filter((k) => (map[k] ?? 0) > 0);
}

/** Billed Nearby calls per load: one per Google source switched on. */
export function googleCallsPerLoad(map: Pick<DiscoveryConfig["map"], AreaSourceKey>): number {
  return (map.googlePopular > 0 ? 1 : 0) + (map.googleClosest > 0 ? 1 : 0);
}

/** True when the point sits inside the location's Radius (no point: true). */
function insideLocation(location: AreaLocation, lat: number | null, lng: number | null): boolean {
  if (location.kind === "point") {
    const km = haversineKm(location.anchor.lat, location.anchor.lng, lat, lng);
    return Number.isFinite(km) && km <= location.radiusKm;
  }
  return true;
}

/** Eligibility after Google answers (never an API param, never a refill):
 *  inside the location and active. No reviews floor (MESITA-2721): the
 *  Popularity floor is the quality cut, in area-score.ts. */
export function eligibleGoogleHits(
  hits: readonly NearbyHit[],
  location: AreaLocation,
  cfg: { general: GeneralConfig },
): NearbyHit[] {
  const seen = new Set<string>();
  return hits.filter((hit) => {
    if (seen.has(hit.placeId)) return false;
    seen.add(hit.placeId);
    if (!insideLocation(location, hit.lat, hit.lng)) return false;
    return clearsGeneralGate(cfg.general, hit);
  });
}

// ── The pool ────────────────────────────────────────────────────────────

export type AreaPoolDeps<T extends OwnedRow> = {
  /** GMP key, or null when the server has none (no Google call). */
  apiKey: string | null;
  location: AreaLocation;
  /** The Family gate's requested families; empty = every family. */
  families: readonly string[];
  /** Nearby `includedPrimaryTypes`: the families pushed down. Empty = no
   *  Google call. */
  types: readonly string[];
  /** The caller's Mesita read (gates pushed down, `selectedPoolQuery`). */
  mesitaRows: readonly T[];
  cfg: Pick<DiscoveryConfig, "general" | "map" | "params">;
  /** Which surface asks: picks Places shown (MESITA-2727). Required, so a
   *  new caller has to choose. */
  surface: AreaSurface;
  /** The per-IP ledger, once per billed call. False = that call skipped. */
  consumeQuota: () => Promise<boolean>;
  /** Ready Mesita rows holding these google ids; null on error. */
  lookupOwned: (gids: string[]) => Promise<T[] | null>;
};

/** The breakdown a pool place carries: the score's, its primary family
 *  (MESITA-2438, null when it has none) and every source that found it
 *  (MESITA-2703; diagnostics only, no card draws it). */
export type AreaPoolDiagnostics = AreaDiagnostics & {
  primaryFamily: string | null;
  foundBy: AreaSourceKey[];
};

export type AreaPoolPlace = Record<string, unknown> & { id: string; area: AreaPoolDiagnostics };

export type AreaPoolSummary = {
  googleCalls: number;
  googleBilled: number;
  googleRefused: number;
  googleFailed: number;
  /** "partial" when some calls were refused and others answered. */
  quota: "ok" | "partial" | "refused" | "none";
  googleHits: number;
  /** The switches that ran ("none" when no source could run: every switch
   *  off, or no point and Mesita Popularity off). */
  sources: AreaSourceKey[] | "none";
  /** Places each source returned after its own gates, before the merge. */
  sourceCounts: Record<AreaSourceKey, number>;
  google: number;
  mesita: number;
  returned: number;
  /** Which surface ran, and the two numbers it read (MESITA-2727). */
  surface?: AreaSurface;
  distancePenalty?: number;
  placesShown?: number;
};

type PoolItem = {
  candidate: AreaCandidate;
  place: Record<string, unknown>;
  primary: string | null;
  foundBy: Set<AreaSourceKey>;
};

function roundedKm(location: AreaLocation, lat: unknown, lng: unknown): number | null {
  if (location.kind !== "point") return null;
  const km = haversineKm(location.anchor.lat, location.anchor.lng, numOrNull(lat), numOrNull(lng));
  return Number.isFinite(km) ? Math.round(km * 10) / 10 : null;
}

/** An owned row's card: its own facts, the hit's only where it has none. */
function ownedPlace(row: OwnedRow, hit: NearbyHit, location: AreaLocation): Record<string, unknown> {
  const { google_place_id: _gid, ...rest } = row;
  return {
    ...rest,
    google_stars_overall: numOrNull(row.google_stars_overall) ?? hit.rating,
    google_review_count: numOrNull(row.google_review_count) ?? hit.reviewCount,
    distance_km: roundedKm(location, row.lat ?? hit.lat, row.lng ?? hit.lng),
  };
}

async function googleItems<T extends OwnedRow>(
  deps: AreaPoolDeps<T>,
  sources: readonly AreaSourceKey[],
  summary: AreaPoolSummary,
): Promise<PoolItem[]> {
  const { apiKey, location, types } = deps;
  const google = sources.filter((k): k is "googlePopular" | "googleClosest" =>
    k === "googlePopular" || k === "googleClosest"
  );
  if (!apiKey || types.length === 0 || location.kind !== "point" || google.length === 0) return [];
  const center = snapCenter(location.anchor);
  // The Family gate pushed down exactly: a general type's precise subtypes
  // that belong to no requested family never come back to be thrown away.
  const excludedTypes = nearbyExcludedTypesForFamilies(types, deps.families);
  const answers = await Promise.all(google.map((source) =>
    searchNearbyPlacesOutcome(apiKey, center, {
      types,
      radiusKm: location.radiusKm,
      excludedTypes,
      rankPreference: GOOGLE_SOURCE_RANK[source],
      beforeFanout: deps.consumeQuota,
    }).then((answer) => ({ source, ...answer }))
  ));
  const tally: Record<NearbyOutcome, number> = { billed: 0, refused: 0, failed: 0, none: 0 };
  for (const a of answers) tally[a.outcome]++;
  summary.googleCalls = answers.length;
  summary.googleBilled = tally.billed;
  summary.googleRefused = tally.refused;
  summary.googleFailed = tally.failed;
  summary.quota = tally.refused === 0
    ? "ok"
    : tally.refused === answers.length
    ? "refused"
    : "partial";
  summary.googleHits = answers.reduce((n, a) => n + a.hits.length, 0);

  // One entry per Place ID, keeping every source that found it.
  const byPlace = new Map<string, { hit: NearbyHit; foundBy: Set<AreaSourceKey> }>();
  for (const a of answers) {
    const kept = eligibleGoogleHits(a.hits, location, deps.cfg);
    summary.sourceCounts[a.source] = kept.length;
    for (const hit of kept) {
      const seen = byPlace.get(hit.placeId);
      if (seen) seen.foundBy.add(a.source);
      else byPlace.set(hit.placeId, { hit, foundBy: new Set([a.source]) });
    }
  }
  if (byPlace.size === 0) return [];
  const owned = await deps.lookupOwned([...byPlace.keys()]);
  // Without the owned set a stub could shadow a Mesita place: fail closed.
  if (owned === null) return [];
  const byGid = new Map<string, T>();
  for (const row of owned) {
    const gid = typeof row.google_place_id === "string" ? row.google_place_id.trim() : "";
    if (gid && !byGid.has(gid)) byGid.set(gid, row);
  }
  return [...byPlace.values()].map(({ hit, foundBy }) => {
    const row = byGid.get(hit.placeId);
    if (row) {
      const candidate = ownedCandidate(row, hit);
      const primary = knownFamilies(mesitaCandidate(row).familyKeys).length > 0
        ? mesitaPrimaryFamily(row)
        : placeFamilies(hit.primaryType, hit.types).primary;
      return { candidate, place: ownedPlace(row, hit, location), primary, foundBy };
    }
    const stub = googleStub(hit, roundedKm(location, hit.lat, hit.lng));
    return {
      candidate: stubCandidate(stub, hit),
      place: stub,
      primary: placeFamilies(hit.primaryType, hit.types).primary,
      foundBy,
    };
  });
}

/** `map.placesShown` when a caller's cfg predates it. */
const AREA_PLACES_SHOWN_FALLBACK = 20;

/** One Mesita source's pick: at most 20 rows that clear the gates. */
const MESITA_SOURCE_MAX = 20;

/**
 * Mesita Popularity and Mesita Proximity (MESITA-2703), picked in memory from the
 * caller's radius-boxed read (capped at `NEARBY_SCAN_LIMIT`, ordered by id;
 * the EF logs `mesitaCapped`). Popular ranks by the score's own Popularity
 * part, Popularity × the Selected boost, so a Selected row competes for a
 * slot with the boost it scores with and the pick agrees with the ranking
 * (MESITA-2717); equal parts fall back to raw Popularity. Proximity ranks by
 * distance; both then by id. Proximity needs a point.
 */
function mesitaItems<T extends OwnedRow>(
  deps: AreaPoolDeps<T>,
  sources: readonly AreaSourceKey[],
  ctx: AreaContext,
  summary: AreaPoolSummary,
): PoolItem[] {
  const wantPopular = sources.includes("mesitaPopular");
  const wantClosest = sources.includes("mesitaClosest") && deps.location.kind === "point";
  if (!wantPopular && !wantClosest) return [];
  const open = rankArea(
    deps.mesitaRows.map((row) => ({
      candidate: mesitaCandidate(row),
      place: { ...row, distance_km: roundedKm(deps.location, row.lat, row.lng) },
      primary: mesitaPrimaryFamily(row),
      foundBy: new Set<AreaSourceKey>(),
    })),
    (item) => item.candidate,
    ctx,
  );
  const byId = (a: { item: PoolItem }, b: { item: PoolItem }) =>
    a.item.candidate.id.localeCompare(b.item.candidate.id);
  const picks: PoolItem[] = [];
  if (wantPopular) {
    const top = [...open]
      .sort((a, b) =>
        popularPart(b.item.candidate, ctx) - popularPart(a.item.candidate, ctx) ||
        logPopularity(b.item.candidate) - logPopularity(a.item.candidate) ||
        byId(a, b)
      )
      .slice(0, MESITA_SOURCE_MAX);
    for (const { item } of top) item.foundBy.add("mesitaPopular");
    summary.sourceCounts.mesitaPopular = top.length;
    picks.push(...top.map(({ item }) => item));
  }
  if (wantClosest) {
    const near = [...open]
      .sort((a, b) =>
        (a.area.distanceKm ?? Infinity) - (b.area.distanceKm ?? Infinity) || byId(a, b)
      )
      .slice(0, MESITA_SOURCE_MAX);
    for (const { item } of near) item.foundBy.add("mesitaClosest");
    summary.sourceCounts.mesitaClosest = near.length;
    picks.push(...near.map(({ item }) => item));
  }
  return picks;
}

/**
 * The Area pool: the four sources pulled, merged (one card per place), gated,
 * scored and ranked globally, every place carrying its `area` breakdown.
 */
export async function selectAreaPool<T extends OwnedRow>(
  deps: AreaPoolDeps<T>,
): Promise<{ places: AreaPoolPlace[]; summary: AreaPoolSummary }> {
  const sources = areaSourcesOn(deps.cfg.map).filter((k) =>
    deps.location.kind === "point" || k === "mesitaPopular"
  );
  const summary: AreaPoolSummary = {
    googleCalls: 0,
    googleBilled: 0,
    googleRefused: 0,
    googleFailed: 0,
    quota: "none",
    googleHits: 0,
    sources: sources.length > 0 ? sources : "none",
    sourceCounts: { googlePopular: 0, googleClosest: 0, mesitaPopular: 0, mesitaClosest: 0 },
    google: 0,
    mesita: 0,
    returned: 0,
  };
  const ctx: AreaContext = {
    location: deps.location,
    families: deps.families,
    ...areaSignalParams(deps.cfg.params, deps.cfg.map),
  };
  // The operator's cut (MESITA-2713), per surface (MESITA-2727).
  const shown = (deps.surface === "catalog" ? deps.cfg.map.catalogPlacesShown : undefined) ??
    deps.cfg.map.placesShown ?? AREA_PLACES_SHOWN_FALLBACK;
  summary.surface = deps.surface;
  summary.distancePenalty = ctx.radiusDivisor;
  summary.placesShown = shown;
  const fromGoogle = await googleItems(deps, sources, summary);
  const fromMesita = mesitaItems(deps, sources, ctx, summary);

  // One card per place. An owned hit is the same Mesita row, and its
  // version (scored on the hit's numbers) wins; `foundBy` keeps every
  // source that found it.
  const byId = new Map<string, PoolItem>();
  for (const item of [...fromGoogle, ...fromMesita]) {
    const seen = byId.get(item.candidate.id);
    if (!seen) byId.set(item.candidate.id, item);
    else for (const k of item.foundBy) seen.foundBy.add(k);
  }

  // The top `shown` of the merged, sorted pool (up to 80 = 4 sources × 20).
  const ranked = primaryFirst(
    rankArea([...byId.values()], (item) => item.candidate, ctx),
    deps.families,
  ).slice(0, Math.max(0, shown));
  const places = ranked.map(({ item, area }) => {
    const { distanceKm: _km, ...diagnostics } = area;
    const foundBy = AREA_SOURCE_KEYS.filter((k) => item.foundBy.has(k));
    return {
      ...item.place,
      area: { ...diagnostics, primaryFamily: item.primary, foundBy },
    } as AreaPoolPlace;
  });
  summary.google = places.filter((p) => p.area.source === "google").length;
  summary.mesita = places.length - summary.google;
  summary.returned = places.length;
  return { places, summary };
}

/**
 * A family row lists its PRIMARY places first and its SECONDARY places as
 * fill (MESITA-2438): a stable partition of the ranked list, so each part
 * keeps the score's order. No family requested = the ranked list as is.
 * Relevance, never money: nothing here reads who pays.
 */
export function primaryFirst<T extends { item: { primary: string | null } }>(
  ranked: readonly T[],
  families: readonly string[],
): T[] {
  if (families.length === 0) return [...ranked];
  const wanted = new Set(families);
  const primary = ranked.filter((r) => r.item.primary !== null && wanted.has(r.item.primary));
  const fill = ranked.filter((r) => !(r.item.primary !== null && wanted.has(r.item.primary)));
  return [...primary, ...fill];
}

/** The log line's view of a pool: per-family counts. */
export function areaPoolLogFields(places: readonly AreaPoolPlace[]): {
  families: Record<string, number>;
} {
  const families: Record<string, number> = {};
  for (const p of places) {
    for (const f of p.area.familyKeys) families[f] = (families[f] ?? 0) + 1;
  }
  return { families };
}

// ── The Mesita read ─────────────────────────────────────────────────────

/** The builder `selectedPoolQuery` needs (supabase-js satisfies it). */
export type SelectedPoolQuery<Q> =
  & FilterableQuery<Q>
  & BboxQuery<Q>
  & {
    not: (col: string, op: string, val: unknown) => Q;
    overlaps: (col: string, val: string[]) => Q;
    order: (col: string, opts?: { ascending?: boolean }) => Q;
  };

/** A supabase-js select, seen structurally: what the EFs hand
 *  `selectedPoolQuery` (the full generic type is too deep to infer). */
export interface PoolBuilder extends SelectedPoolQuery<PoolBuilder> {
  limit: (n: number) => PromiseLike<{
    data: unknown[] | null;
    error: { message: string } | null;
  }>;
}

/**
 * The Mesita pool in SQL, with the gates PUSHED DOWN so a dense area does
 * not fill the row cap with rows the ranking would drop: ready, active, the
 * requested families, and the radius box around the point (no point, no
 * box). `selectedOnly` (Chat, the default) also keeps only Mesita Selected
 * rows — the operator's mark, `places.selected` (MESITA-2707), never
 * `enriched_at`; the Feed and the Map pass false, because Selected is a tag
 * on their cards, not their gate.
 */
export function selectedPoolQuery<Q extends SelectedPoolQuery<Q>>(
  query: Q,
  cfg: Pick<DiscoveryConfig, "general">,
  opts: {
    center: LatLng | null;
    radiusKm: number;
    families?: readonly string[];
    selectedOnly?: boolean;
  },
): Q {
  let q: Q = query.eq("content_state", "ready");
  if (opts.selectedOnly !== false) q = q.eq("selected", true);
  q = applyGeneralGateQuery(q, cfg.general);
  if (opts.families && opts.families.length > 0) {
    q = q.overlaps("family_keys", [...opts.families]);
  }
  if (opts.center) {
    q = applyBboxPredicate(
      q,
      nearbyBbox(opts.center.lat, opts.center.lng, opts.radiusKm),
    );
  }
  // A capped pool must be the same slice every time: without an order,
  // Postgres may hand back any N rows once the area holds more than the cap.
  return q.order("id", { ascending: true });
}

// ── Chat's Selected read (MESITA-2339) ──────────────────────────────────

export type SelectedOpts = {
  /** The anchor, or null (no radius, Popularity alone orders). */
  center: LatLng | null;
  radiusKm: number;
  /** The Family gate's requested families; empty or absent = every family. */
  families?: readonly string[];
  params: SignalParams;
  /** The Popularity floor (MESITA-2714); absent = off. */
  popularityFloor?: number;
  /** The Selected boost (MESITA-2717). Every row here is Selected, so it
   *  scales the scores and never reorders them. */
  selectedFactor?: number;
  limit?: number;
};

/** Mesita Selected rows ranked by the Area score (inside the radius). */
export function selectMesitaSelected<T extends Record<string, unknown>>(
  rows: readonly T[],
  opts: SelectedOpts,
): Array<T & { distance_km: number | null }> {
  const location: AreaLocation = opts.center
    ? { kind: "point", anchor: opts.center, radiusKm: opts.radiusKm }
    : { kind: "none" };
  const ranked = rankArea(
    rows.filter((row) => mesitaSource(row) === "selected"),
    mesitaCandidate,
    {
      location,
      families: opts.families ?? [],
      // The Distance penalty (MESITA-2720/2776): half credit at the current-location radius ÷ k.
      ...areaSignalParams(opts.params, opts),
    },
  );
  const out = ranked.map(({ item }) => ({
    ...item,
    distance_km: roundedKm(location, item.lat, item.lng),
  }));
  return opts.limit === undefined ? out : out.slice(0, opts.limit);
}

/** What a non-view caller needs of a Selected place, About included. */
const AREA_SELECTED_COLUMNS =
  "id, slug, name, address, lat, lng, family_keys, google_stars_overall, google_review_count, description, enriched_at, content_state, selected, spotlight_tier";
/** The Selected pool cap for a non-view caller: a few answers, not a map. */
const AREA_SELECTED_POOL = 300;

/**
 * Mesita Selected places for a caller that is not a view — the Chat Agent
 * (MESITA-2339). The same pool query (gates pushed down, Selected only) and
 * the same score, around the guest's location when there is one. No Google
 * call. Null on error.
 */
export async function areaSelectedPlaces(
  admin: SupabaseClient,
  cfg: Pick<DiscoveryConfig, "general" | "map" | "params">,
  opts: { center: LatLng | null; families: readonly string[]; limit: number },
): Promise<Array<Record<string, unknown> & { distance_km: number | null }> | null> {
  const { data, error } = await selectedPoolQuery(
    admin
      .from("profiles")
      .select(AREA_SELECTED_COLUMNS)
      .eq("state", "active") as unknown as PoolBuilder,
    cfg,
    { center: opts.center, radiusKm: cfg.map.radiusKm, families: opts.families, selectedOnly: true },
  ).limit(AREA_SELECTED_POOL);
  if (error) {
    console.error("[area-pipeline] selected:", error.message);
    return null;
  }
  return selectMesitaSelected((data ?? []) as Record<string, unknown>[], {
    center: opts.center,
    radiusKm: cfg.map.radiusKm,
    families: opts.families,
    params: cfg.params,
    popularityFloor: cfg.map.popularityFloor,
    selectedFactor: cfg.map.selectedFactor,
    limit: opts.limit,
  });
}
