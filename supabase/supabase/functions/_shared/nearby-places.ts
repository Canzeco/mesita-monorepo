// Map catalog = three closest-N lanes, then one list after dropping overlaps:
//   1. closest partnerCount Mesita partners (plan ≠ free)
//   2. closest mesitaCount Mesita places (partners included)
//   3. closest googleCount Google Nearby hits
// Search power zeros unused lanes: 1 Partners, 2 + enriched Places, 3 + Google.
// Mesita Places is enriched only — Created / Requested stubs are not a source.
// Power 1–2 never fire Google Nearby. Merge is concatenate after dropping
// concurrencies: Partners, then Mesita, then Google. Union 20–40 at defaults
// (10 + 10 + 20). Dedup Google against every known Mesita Place ID (not just
// the tops), so a listed place that missed its lane never comes back as a
// gray stub. Google maxes a Nearby call at 20; type batteries ride that one
// call.

import {
  GOOGLE_PLACES_NEARBY_URL,
  classifyGoogleError,
} from "./google-places.ts";
import {
  DEFAULT_MAP,
  type MapConfig,
} from "./discovery-config.ts";
import { isPaidPlan } from "./membership-enforcement-helpers.ts";
import {
  haversineKm,
  NEARBY_RADIUS_KM,
  takeClosest,
} from "./geo.ts";

export const MESITA_NEARBY_MAX =
  DEFAULT_MAP.partnerCount + DEFAULT_MAP.mesitaCount;
export const GOOGLE_NEARBY_MAX = 20;
export const CATALOG_NEARBY_MAX = MESITA_NEARBY_MAX + DEFAULT_MAP.googleCount;
export const CATALOG_NEARBY_HARD_MAX = 60;
/** Mesita rows admitted from the 50 km box before distance rank. Not newest-N:
 *  a close listed place that is older than 200 newer rows in the city must
 *  still win its Google Place ID, or it reappears as a gray stub. */
export const MESITA_NEARBY_POOL = 1000;
export const GOOGLE_NEARBY_RADIUS_M = NEARBY_RADIUS_KM * 1000;
const NEARBY_CACHE_MS = 15_000;

export const NEARBY_TYPES = [
  "restaurant",
  "bar",
  "cafe",
  "night_club",
  "bakery",
] as const;

export type NearbyType = (typeof NEARBY_TYPES)[number];

export type NearbyHit = {
  placeId: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  primaryType: string | null;
};

function stripPlacesPrefix(id: string): string {
  return id.startsWith("places/") ? id.slice("places/".length) : id;
}

type NearbyOnce =
  | { ok: true; hits: NearbyHit[] }
  | { ok: false };

async function searchNearbyOnce(
  apiKey: string,
  center: { lat: number; lng: number },
  radiusM: number,
  includedPrimaryTypes: string[],
): Promise<NearbyOnce> {
  const r = await fetch(GOOGLE_PLACES_NEARBY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.primaryType",
    },
    body: JSON.stringify({
      maxResultCount: GOOGLE_NEARBY_MAX,
      rankPreference: "DISTANCE",
      includedPrimaryTypes,
      locationRestriction: {
        circle: {
          center: { latitude: center.lat, longitude: center.lng },
          radius: Math.min(50_000, Math.max(50, radiusM)),
        },
      },
    }),
  });
  if (!r.ok) {
    const text = await r.text();
    const code = classifyGoogleError(r.status, text);
    console.error("[nearby] Google searchNearby failed", code, r.status);
    return { ok: false };
  }
  const data = (await r.json()) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      rating?: number;
      primaryType?: string;
    }>;
  };
  const hits = (data.places ?? [])
    .map((p) => {
      const raw = p.id ?? "";
      const placeId = stripPlacesPrefix(raw);
      const lat = p.location?.latitude;
      const lng = p.location?.longitude;
      return {
        placeId,
        name: p.displayName?.text ?? "",
        address: p.formattedAddress ?? "",
        lat: typeof lat === "number" ? lat : null,
        lng: typeof lng === "number" ? lng : null,
        rating: typeof p.rating === "number" ? p.rating : null,
        primaryType: p.primaryType ?? null,
      };
    })
    .filter((p) => p.placeId && p.name);
  return { ok: true, hits };
}

const nearbyCache = new Map<string, { at: number; hits: NearbyHit[] }>();
const nearbyInflight = new Map<string, Promise<NearbyHit[]>>();
/** Per-isolate cap on Google Nearby calls (one Search per cache-miss cell).
 *  Isolates do not share this; it still bounds one spray against a warm
 *  isolate. */
export const GOOGLE_FANOUT_MAX = 20;
export const GOOGLE_FANOUT_WINDOW_MS = 60_000;
let googleFanoutAt: number[] = [];

function pruneGoogleFanout(now: number): void {
  googleFanoutAt = googleFanoutAt.filter((at) => now - at < GOOGLE_FANOUT_WINDOW_MS);
}

export function __resetNearbyGoogleCacheForTests(): void {
  nearbyCache.clear();
  nearbyInflight.clear();
  googleFanoutAt = [];
}

/** Warm 15s cell hit, or null. List-places uses this so a cache hit does not
 *  consume the shared IP quota — only a miss meters, then fan-out. Types must
 *  match the search that filled the cell. */
export function peekCachedNearbyPlaces(
  center: { lat: number; lng: number },
  types?: readonly string[],
): NearbyHit[] | null {
  const hit = nearbyCache.get(nearbyCellKey(center, resolveNearbyTypes(types)));
  if (hit && Date.now() - hit.at < NEARBY_CACHE_MS) return hit.hits;
  return null;
}

export type SearchNearbyOpts = {
  radiusM?: number;
  /** Subset of NEARBY_TYPES. Omit = all five. Empty = no Google call. */
  types?: readonly string[];
  /** Called only by the request that starts the Nearby calls — not on
   *  a warm cell, an in-flight join, or an isolate-budget skip. Return false
   *  to skip Google (quota deny). */
  beforeFanout?: () => Promise<boolean>;
};

function nearbyTypesKey(types: readonly string[]): string {
  return [...types].sort().join(",") || "none";
}

function nearbyCellKey(
  center: { lat: number; lng: number },
  types: readonly string[] = NEARBY_TYPES,
): string {
  return `${center.lat.toFixed(2)},${center.lng.toFixed(2)}:${nearbyTypesKey(types)}`;
}

function resolveNearbyTypes(types?: readonly string[]): readonly string[] {
  if (!types) return NEARBY_TYPES;
  const allowed = new Set<string>(NEARBY_TYPES);
  return types.filter((t) => allowed.has(t));
}

/** Closest Google food/drink places around `center`. One Nearby Search
 *  (New) with the enabled primary types, max 20, DISTANCE rank. Same ~1 km
 *  cell reuses a successful 15s result so a pan-idle does not spend a
 *  billed call twice. HTTP / parse failures are returned (Mesita still
 *  shows) but never cached. Concurrent same-cell pans share one in-flight
 *  call. Each isolate also caps cache-miss calls (20 / 60s). Shared IP
 *  quota is `beforeFanout` (nearby-google-quota.ts). */
export async function searchNearbyPlaces(
  apiKey: string,
  center: { lat: number; lng: number },
  opts: SearchNearbyOpts | number = {},
): Promise<NearbyHit[]> {
  const parsed = typeof opts === "number"
    ? { radiusM: opts, beforeFanout: undefined, types: undefined }
    : opts;
  const radius = parsed.radiusM ?? GOOGLE_NEARBY_RADIUS_M;
  const beforeFanout = parsed.beforeFanout;
  const types = resolveNearbyTypes(parsed.types);
  if (types.length === 0) return [];
  const key = nearbyCellKey(center, types);
  const hit = nearbyCache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < NEARBY_CACHE_MS) return hit.hits;
  const pending = nearbyInflight.get(key);
  if (pending) return pending;

  let resolveRun: (hits: NearbyHit[]) => void = () => {};
  const placeholder = new Promise<NearbyHit[]>((resolve) => {
    resolveRun = resolve;
  });
  nearbyInflight.set(key, placeholder);

  try {
    pruneGoogleFanout(Date.now());
    if (googleFanoutAt.length >= GOOGLE_FANOUT_MAX) {
      console.warn("[nearby] isolate Google fan-out budget exhausted");
      resolveRun([]);
      return [];
    }
    if (beforeFanout && !(await beforeFanout())) {
      resolveRun([]);
      return [];
    }
    pruneGoogleFanout(Date.now());
    if (googleFanoutAt.length >= GOOGLE_FANOUT_MAX) {
      console.warn("[nearby] isolate Google fan-out budget exhausted");
      resolveRun([]);
      return [];
    }
    googleFanoutAt.push(Date.now());
    const batch = await searchNearbyOnce(apiKey, center, radius, [...types]);
    const hits = batch.ok ? batch.hits : [];
    if (batch.ok) nearbyCache.set(key, { at: Date.now(), hits });
    resolveRun(hits);
    return hits;
  } catch (err) {
    resolveRun([]);
    throw err;
  } finally {
    nearbyInflight.delete(key);
  }
}

export type MesitaNearbyRow = {
  id: string;
  google_place_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  plan?: string | null;
  partner?: boolean | null;
};

export type NearbyLaneCaps = {
  partnerCount: number;
  mesitaCount: number;
  googleCount: number;
};

export type NearbyMerged<T> =
  | { kind: "listed"; row: T }
  | { kind: "google"; hit: NearbyHit };

export function nearbyLanesFromMap(map: MapConfig): NearbyLaneCaps {
  return {
    partnerCount: map.partnerCount,
    mesitaCount: map.mesitaCount,
    googleCount: map.googleCount,
  };
}

/** Search power: 1 Partners · 2 + Mesita Places (default) · 3 + Google. */
export function clampSearchPower(value: unknown): 1 | 2 | 3 {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 2;
  if (n <= 1) return 1;
  if (n >= 3) return 3;
  return 2;
}

export function lanesForSearchPower(
  map: MapConfig,
  power: 1 | 2 | 3,
): NearbyLaneCaps {
  const lanes = nearbyLanesFromMap(map);
  if (power <= 1) return { ...lanes, mesitaCount: 0, googleCount: 0 };
  if (power === 2) return { ...lanes, googleCount: 0 };
  return lanes;
}

/** Mesita Places on Search: enriched profile, not a Created stub. */
export function isEnrichedListedRow(row: {
  content_status?: string | null;
  enriched_at?: string | null;
}): boolean {
  return row.content_status === "ready" || Boolean(row.enriched_at);
}

/** Partners always stay. Power 1 drops everyone else. Power 2–3 keep enriched only. */
export function keepListedForSearchPower(
  row: MesitaNearbyRow & {
    content_status?: string | null;
    enriched_at?: string | null;
  },
  power: 1 | 2 | 3,
): boolean {
  if (isMesitaPartnerRow(row)) return true;
  if (power <= 1) return false;
  return isEnrichedListedRow(row);
}

/** Any Mesita row's Place ID — including Created/Requested — must not stub as Google. */
export function listedGooglePlaceIds(
  rows: Array<{ google_place_id?: string | null }>,
): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.google_place_id) ids.add(row.google_place_id);
  }
  return ids;
}

export function dropKnownMesitaGoogleHits<T extends { placeId: string }>(
  google: T[],
  known: Set<string>,
): T[] {
  if (known.size === 0) return google;
  return google.filter((hit) => !known.has(hit.placeId));
}

export function isMesitaPartnerRow(row: MesitaNearbyRow): boolean {
  if (row.partner === true) return true;
  if (row.partner === false) return false;
  return isPaidPlan(row.plan);
}

export function mergeNearbyCatalog<T extends MesitaNearbyRow>(
  mesita: T[],
  google: NearbyHit[],
  center: { lat: number; lng: number },
  lanes: NearbyLaneCaps = nearbyLanesFromMap(DEFAULT_MAP),
): Array<NearbyMerged<T>> {
  const inCircle = (lat: number | null, lng: number | null) =>
    haversineKm(center.lat, center.lng, lat, lng) <= NEARBY_RADIUS_KM;
  const inMesita = mesita.filter((row) => inCircle(row.lat ?? null, row.lng ?? null));
  const partners = takeClosest(
    inMesita.filter((row) => isMesitaPartnerRow(row)),
    center,
    lanes.partnerCount,
  );
  const mesitaLane = takeClosest(inMesita, center, lanes.mesitaCount);
  const partnerIds = new Set(partners.map((row) => row.id));
  const mesitaExtra = mesitaLane.filter((row) => !partnerIds.has(row.id));
  const knownMesitaIds = new Set(
    mesita
      .map((row) => row.google_place_id)
      .filter((id): id is string => Boolean(id)),
  );
  const extraGoogle = takeClosest(
    google.filter((hit) => inCircle(hit.lat, hit.lng)),
    center,
    lanes.googleCount,
  ).filter((hit) => !knownMesitaIds.has(hit.placeId));
  return [
    ...partners.map((row) => ({ kind: "listed" as const, row })),
    ...mesitaExtra.map((row) => ({ kind: "listed" as const, row })),
    ...extraGoogle.map((hit) => ({ kind: "google" as const, hit })),
  ];
}
