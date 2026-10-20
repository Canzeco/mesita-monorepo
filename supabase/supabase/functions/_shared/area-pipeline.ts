// THE AREA PIPELINE (MESITA-2302, reshaped by MESITA-2327, one pool since
// MESITA-2379). Places relative to a location — a point (the device, a
// saved address, the map's centre) or an area (a city or a neighbourhood's
// bounds). The Feed and the Map are VIEWS of Area; they share this one
// retrieval and ranking, each with its own Google budget.
//
//   Sources  Google Nearby Search · Mesita Places Search
//   Gates    Family · Radius (a point) · Territory (an area) — and the
//            operational ones the sources apply: active, ready (Mesita rows),
//            the Google reviews floor (Google hits)
//   Signals  Proximity (a point) · Popularity
//   Factor   Selected: 1.0 Mesita Selected, 0.3 everything else
//   Score    area-score.ts
//
// `selectAreaPool` is the one entry point for the Feed and the Map:
//   1. Google: 1–3 Nearby calls (`googleCallsForStop`), in parallel, each
//      its own cell and each metered by the per-IP ledger; a refused or
//      failed call adds nothing and the others still count. Hits are deduped
//      by Google Place ID, then judged (inside the location, active, over the
//      reviews floor). Every hit's Place ID is looked up against Mesita: a
//      ready Mesita row that owns it goes out as that row (scored on the
//      hit's numbers, card facts borrowed only where the row lacks them);
//      the rest are Google-only stubs.
//   2. Mesita: the caller's pool read (gates pushed down to SQL), ranked,
//      the top `mesitaLimit` kept.
//   3. One merged pool, deduped (an owned hit and the same Mesita row are one
//      candidate), gated, scored, ranked globally. The caller pages it.
//
// Fail closed on money: no key, no location, no types, a quota refusal or a
// Google error buy nothing; an owned-lookup error drops the Google side (no
// stub may shadow a Mesita place). No photo field is ever asked for a
// Google-only card, nothing here writes a row, and no Google content outlives
// the 15 s isolate cell (Google Maps Platform terms).
//
// Chat (MESITA-2339) does not use the pool: `areaSelectedPlaces` reads Mesita
// Selected places only, with the same score.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { EVERY_FAMILY_TYPES, nearbyTypesForSupers } from "./google-type-super.ts";
import { catalogAdmitted } from "./catalog-rank.ts";
import { googleStub } from "./google-stub.ts";
import { applyBboxPredicate, type BboxQuery, haversineKm, nearbyBbox } from "./geo.ts";
import {
  applyGeneralGateQuery,
  clearsGeneralGate,
  type FilterableQuery,
} from "./discovery-general-gate.ts";
import { clearsMinReviews } from "./map-engine.ts";
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
  type AreaMode,
  type AreaDiagnostics,
  type AreaLocation,
  type AreaSource,
  knownFamilies,
  type LatLng,
  rankArea,
  SELECTED_FACTOR,
  territoryGate,
} from "./area-score.ts";
import {
  POPULARITY_HALF_REVIEWS_DEFAULT,
  PROXIMITY_REACH_KM_DEFAULT,
} from "./pipeline-signals.ts";
import {
  DEFAULT_AREA_MODES,
  type DiscoveryConfig,
  type GeneralConfig,
  type SignalParams,
} from "./discovery-config.ts";
import {
  GOOGLE_NEARBY_MAX,
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

/** Popularity's reviews-for-half-credit, Proximity's reach (MESITA-2431),
 *  Selected's non-Selected value and the mode's row of the weights table
 *  (MESITA-2428, MESITA-2439), from the blob. */
export function areaSignalParams(
  params: SignalParams,
  mode: AreaMode = "nearby",
): Pick<AreaContext, "halfReviews" | "reachKm" | "weights" | "selectedOther"> {
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const row = params.modes?.[mode];
  const d = DEFAULT_AREA_MODES[mode];
  return {
    halfReviews: num(params.popularity?.halfReviews, POPULARITY_HALF_REVIEWS_DEFAULT),
    reachKm: num(params.proximity?.reachKm, PROXIMITY_REACH_KM_DEFAULT),
    weights: {
      proximity: num(row?.proximity, d.proximity),
      popularity: num(row?.popularity, d.popularity),
      selected: num(row?.selected, d.selected),
    },
    selectedOther: num(params.selected?.otherFactor, SELECTED_FACTOR.other),
  };
}

/** Area keeps only Discovery › General's active check: its reviews floor is
 *  the Name pipeline's; Area's own is `map.googleMinReviews`. */
function activeOnly(general: GeneralConfig): GeneralConfig {
  return { ...general, minReviews: 0 };
}

/** A Mesita row that may own a hit: active, ready, with its google id. */
export type OwnedRow = Record<string, unknown> & {
  id: string;
  google_place_id?: string | null;
  lat?: number | null;
  lng?: number | null;
};

const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Mesita Selected or merely a ready Mesita row. */
function mesitaSource(row: Record<string, unknown>): AreaSource {
  return catalogAdmitted(row as { enriched_at?: string | null; content_state?: string | null })
    ? "selected"
    : "mesita";
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

/** A bounds rectangle wider than this (diagonal, km) is not an area the
 *  guest can mean; the request falls back to its point. */
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

/** The client's `bounds`, or null when absent, inverted or too wide. */
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

/** Valid bounds make an area; else a centre makes a point; else none. */
export function resolveAreaLocation(
  bounds: unknown,
  center: LatLng | null,
  radiusKm: number,
): AreaLocation {
  const b = parseAreaBounds(bounds);
  if (b) return { kind: "area", bounds: b };
  if (center) return { kind: "point", anchor: center, radiusKm };
  return { kind: "none" };
}

/** `map.googlePlaces` 20/40/60 → 1/2/3 Nearby calls. */
export function googleCallsForStop(stop: number): number {
  const n = Math.round((Number.isFinite(stop) ? stop : GOOGLE_NEARBY_MAX) / GOOGLE_NEARBY_MAX);
  return Math.max(1, Math.min(3, n));
}

/** The server's snap of a point centre (~110 m) for retrieval and cell
 *  keys, so GPS drift reuses a warm cell; Proximity reads the raw centre. */
export function snapCenter(c: LatLng): LatLng {
  return { lat: Math.round(c.lat * 1000) / 1000, lng: Math.round(c.lng * 1000) / 1000 };
}

export type NearbyCircle = { center: LatLng; radiusKm: number; rank: NearbyRank };

function mid(a: LatLng, b: LatLng): LatLng {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

function circleAround(b: AreaBounds, rank: NearbyRank): NearbyCircle {
  const half = haversineKm(b.low.lat, b.low.lng, b.high.lat, b.high.lng) / 2;
  return {
    center: mid(b.low, b.high),
    radiusKm: Math.min(50, Math.max(0.05, half)),
    rank,
  };
}

/** Nearby's first Google call: the prominent places this close to the
 *  anchor (MESITA-2467). The nearest 20 were mostly corner spots under the
 *  operator's reviews floor (live 100): at La Purísima 19 of 20 dropped and
 *  the list filled with Mesita rows 8 km away. Prominent places clear the
 *  floor and still sit around the crosshair. */
export const NEARBY_INNER_KM = 3;

/**
 * The Google calls for a location, at most `calls` (1–3). A point in the
 * Nearby or Family mode: the prominent 20 within NEARBY_INNER_KM of the
 * anchor, then the nearest 20 in the radius, then the prominent 20 in the
 * radius (the Map's one call is the first). The Popular mode: the prominent
 * 20 in the radius, the nearest 20, the prominent in the inner half-radius
 * circle (MESITA-2425). An area: every call ranks
 * POPULARITY (no centre bias) — the circle around the bounds, then the
 * circles around its two halves, split across the longer side. The circles
 * are retrieval geometry only; nothing scores against their centres.
 */
export function areaFanoutCircles(
  location: AreaLocation,
  calls: number,
  mode: AreaMode = "nearby",
): NearbyCircle[] {
  const n = Math.max(0, Math.min(3, Math.floor(calls)));
  if (location.kind === "point") {
    const c = snapCenter(location.anchor);
    const nearest = { center: c, radiusKm: location.radiusKm, rank: "DISTANCE" as const };
    const prominent = { center: c, radiusKm: location.radiusKm, rank: "POPULARITY" as const };
    const inner = { center: c, radiusKm: location.radiusKm / 2, rank: "POPULARITY" as const };
    // Popular (MESITA-2425) asks for the prominent 20 first, so a one-call
    // map is not left ranking the nearest 20 by Popularity.
    if (mode === "popular") return [prominent, nearest, inner].slice(0, n);
    // Nearby and Family (MESITA-2467): the prominent 20 around the anchor
    // first, so a one-call map gets places near the crosshair that clear
    // the reviews floor.
    const around = {
      center: c,
      radiusKm: Math.min(NEARBY_INNER_KM, location.radiusKm),
      rank: "POPULARITY" as const,
    };
    return [around, nearest, prominent].slice(0, n);
  }
  if (location.kind === "area") {
    const b = location.bounds;
    const m = mid(b.low, b.high);
    const width = haversineKm(m.lat, b.low.lng, m.lat, b.high.lng);
    const height = haversineKm(b.low.lat, m.lng, b.high.lat, m.lng);
    const halves: AreaBounds[] = width >= height
      ? [{ low: b.low, high: { lat: b.high.lat, lng: m.lng } }, { low: { lat: b.low.lat, lng: m.lng }, high: b.high }]
      : [{ low: b.low, high: { lat: m.lat, lng: b.high.lng } }, { low: { lat: m.lat, lng: b.low.lng }, high: b.high }];
    return [
      circleAround(b, "POPULARITY"),
      circleAround(halves[0], "POPULARITY"),
      circleAround(halves[1], "POPULARITY"),
    ].slice(0, n);
  }
  return [];
}

/** True when the point sits inside the location (Radius or Territory). */
function insideLocation(location: AreaLocation, lat: number | null, lng: number | null): boolean {
  if (location.kind === "point") {
    const km = haversineKm(location.anchor.lat, location.anchor.lng, lat, lng);
    return Number.isFinite(km) && km <= location.radiusKm;
  }
  if (location.kind === "area") return territoryGate({ lat, lng }, location.bounds) === 1;
  return true;
}

/** Eligibility after Google answers (never an API param, never a refill):
 *  inside the location, active, and over the reviews floor. */
export function eligibleGoogleHits(
  hits: readonly NearbyHit[],
  location: AreaLocation,
  minReviews: number,
  cfg: { general: GeneralConfig },
): NearbyHit[] {
  const seen = new Set<string>();
  const general = activeOnly(cfg.general);
  return hits.filter((hit) => {
    if (seen.has(hit.placeId)) return false;
    seen.add(hit.placeId);
    if (!insideLocation(location, hit.lat, hit.lng)) return false;
    if (!clearsGeneralGate(general, hit)) return false;
    return !(minReviews > 0) || clearsMinReviews(hit.reviewCount, minReviews);
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
  /** 0–3 Nearby calls (`googleCallsForStop`); 0 = no Google. */
  googleCalls: number;
  /** The Mesita candidates kept after ranking (`map.mesitaPlaces`). */
  mesitaLimit: number;
  /** The caller's Mesita read (gates pushed down, `selectedPoolQuery`). */
  mesitaRows: readonly T[];
  cfg: Pick<DiscoveryConfig, "general" | "map" | "params">;
  /** The per-IP ledger, once per billed call. False = that call skipped. */
  consumeQuota: () => Promise<boolean>;
  /** Ready Mesita rows holding these google ids; null on error. */
  lookupOwned: (gids: string[]) => Promise<T[] | null>;
  /** The guest's mode (MESITA-2428); absent = Nearby, or Family when
   *  families are requested. */
  mode?: AreaMode;
};

/** The breakdown a pool place carries: the score's, plus its primary
 *  family (MESITA-2438), null when it has none. */
export type AreaPoolDiagnostics = AreaDiagnostics & { primaryFamily: string | null };

export type AreaPoolPlace = Record<string, unknown> & { id: string; area: AreaPoolDiagnostics };

export type AreaPoolSummary = {
  googleCalls: number;
  googleBilled: number;
  googleCached: number;
  googleRefused: number;
  googleFailed: number;
  /** "partial" when some calls were refused and others answered. */
  quota: "ok" | "partial" | "refused" | "none";
  googleHits: number;
  google: number;
  mesita: number;
  returned: number;
};

type PoolItem = {
  candidate: AreaCandidate;
  place: Record<string, unknown>;
  primary: string | null;
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
  summary: AreaPoolSummary,
): Promise<PoolItem[]> {
  const { apiKey, location, types } = deps;
  const circles = apiKey && types.length > 0 ? areaFanoutCircles(location, deps.googleCalls, areaMode(deps)) : [];
  if (circles.length === 0) return [];
  // The Family gate pushed down exactly: a general type's precise subtypes
  // that belong to no requested family never come back to be thrown away.
  const excludedTypes = nearbyExcludedTypesForFamilies(types, deps.families);
  const answers = await Promise.all(circles.map((c) =>
    searchNearbyPlacesOutcome(apiKey!, c.center, {
      types,
      radiusKm: c.radiusKm,
      excludedTypes,
      rankPreference: c.rank,
      preciseCell: true,
      beforeFanout: deps.consumeQuota,
    })
  ));
  const tally: Record<NearbyOutcome, number> = { billed: 0, cached: 0, refused: 0, failed: 0, none: 0 };
  for (const a of answers) tally[a.outcome]++;
  summary.googleCalls = circles.length;
  summary.googleBilled = tally.billed;
  summary.googleCached = tally.cached;
  summary.googleRefused = tally.refused;
  summary.googleFailed = tally.failed;
  summary.quota = tally.refused === 0
    ? "ok"
    : tally.refused === circles.length
    ? "refused"
    : "partial";
  const hits = answers.flatMap((a) => a.hits);
  summary.googleHits = hits.length;

  const eligible = eligibleGoogleHits(
    hits,
    location,
    // The operator's minimum alone (MESITA-2417): no guest stop.
    deps.cfg.map.googleMinReviews ?? 0,
    deps.cfg,
  );
  if (eligible.length === 0) return [];
  const owned = await deps.lookupOwned(eligible.map((hit) => hit.placeId));
  // Without the owned set a stub could shadow a Mesita place: fail closed.
  if (owned === null) return [];
  const byGid = new Map<string, T>();
  for (const row of owned) {
    const gid = typeof row.google_place_id === "string" ? row.google_place_id.trim() : "";
    if (gid && !byGid.has(gid)) byGid.set(gid, row);
  }
  return eligible.map((hit) => {
    const row = byGid.get(hit.placeId);
    if (row) {
      const candidate = ownedCandidate(row, hit);
      const primary = knownFamilies(mesitaCandidate(row).familyKeys).length > 0
        ? mesitaPrimaryFamily(row)
        : placeFamilies(hit.primaryType, hit.types).primary;
      return { candidate, place: ownedPlace(row, hit, location), primary };
    }
    const stub = googleStub(hit, roundedKm(location, hit.lat, hit.lng));
    return {
      candidate: stubCandidate(stub, hit),
      place: stub,
      primary: placeFamilies(hit.primaryType, hit.types).primary,
    };
  });
}

/** A requested family is the Family mode whatever the caller sent: every
 *  family shares that row of the table (MESITA-2428). */
export function areaMode(deps: { mode?: AreaMode; families: readonly string[] }): AreaMode {
  return deps.families.length > 0 ? "family" : deps.mode ?? "nearby";
}

/**
 * The Area pool: Google and Mesita candidates merged, deduped, gated,
 * scored and ranked globally, every place carrying its `area` breakdown.
 */
export async function selectAreaPool<T extends OwnedRow>(
  deps: AreaPoolDeps<T>,
): Promise<{ places: AreaPoolPlace[]; summary: AreaPoolSummary }> {
  const summary: AreaPoolSummary = {
    googleCalls: 0,
    googleBilled: 0,
    googleCached: 0,
    googleRefused: 0,
    googleFailed: 0,
    quota: "none",
    googleHits: 0,
    google: 0,
    mesita: 0,
    returned: 0,
  };
  const ctx: AreaContext = {
    location: deps.location,
    families: deps.families,
    ...areaSignalParams(deps.cfg.params, areaMode(deps)),
  };
  const fromGoogle = await googleItems(deps, summary);

  const mesitaRanked = rankArea(
    deps.mesitaRows.map((row) => ({
      candidate: mesitaCandidate(row),
      place: { ...row, distance_km: roundedKm(deps.location, row.lat, row.lng) },
      primary: mesitaPrimaryFamily(row),
    })),
    (item) => item.candidate,
    ctx,
  ).slice(0, Math.max(0, deps.mesitaLimit));

  // One candidate per place: an owned hit is the same Mesita row, and its
  // version (scored on the hit's numbers) wins.
  const byId = new Map<string, PoolItem>();
  for (const item of fromGoogle) if (!byId.has(item.candidate.id)) byId.set(item.candidate.id, item);
  for (const { item } of mesitaRanked) if (!byId.has(item.candidate.id)) byId.set(item.candidate.id, item);

  const ranked = primaryFirst(
    rankArea([...byId.values()], (item) => item.candidate, ctx),
    deps.families,
  );
  const places = ranked.map(({ item, area }) => {
    const { distanceKm: _km, ...diagnostics } = area;
    return { ...item.place, area: { ...diagnostics, primaryFamily: item.primary } } as AreaPoolPlace;
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

/** The log line's view of a pool: per-family counts, and how many of the
 *  top 10 are Mesita Selected (the factor's measurable effect). */
export function areaPoolLogFields(places: readonly AreaPoolPlace[]): {
  families: Record<string, number>;
  selectedTop10: number;
} {
  const families: Record<string, number> = {};
  for (const p of places) {
    for (const f of p.area.familyKeys) families[f] = (families[f] ?? 0) + 1;
  }
  return {
    families,
    selectedTop10: places.slice(0, 10).filter((p) => p.area.source === "selected").length,
  };
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
 * requested families, and the location's box (the radius box around a point,
 * or the area's bounds). `selectedOnly` (Chat, the default) also keeps only
 * Mesita Selected rows (an Enrich run completed); the Feed and the Map pass
 * false, because Selected is their factor, not their gate.
 */
export function selectedPoolQuery<Q extends SelectedPoolQuery<Q>>(
  query: Q,
  cfg: Pick<DiscoveryConfig, "general">,
  opts: {
    center: LatLng | null;
    radiusKm: number;
    families?: readonly string[];
    bounds?: AreaBounds | null;
    selectedOnly?: boolean;
  },
): Q {
  let q: Q = query.eq("content_state", "ready");
  if (opts.selectedOnly !== false) q = q.not("enriched_at", "is", null);
  q = applyGeneralGateQuery(q, activeOnly(cfg.general));
  if (opts.families && opts.families.length > 0) {
    q = q.overlaps("family_keys", [...opts.families]);
  }
  if (opts.bounds) {
    q = applyBboxPredicate(q, {
      south: opts.bounds.low.lat,
      west: opts.bounds.low.lng,
      north: opts.bounds.high.lat,
      east: opts.bounds.high.lng,
    });
  } else if (opts.center) {
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
      ...areaSignalParams(opts.params),
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
  "id, slug, name, address, lat, lng, family_keys, google_stars_overall, google_review_count, description, enriched_at, content_state";
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
    limit: opts.limit,
  });
}
