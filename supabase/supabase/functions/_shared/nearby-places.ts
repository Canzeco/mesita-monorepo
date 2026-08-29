// Map catalog = closest N of the selected Places set, then paint.
// TWO nested sets (Pato, 2026-08-29): Mesita Places ⊂ Google Places.
// Partners are not a set — they are Mesita Places painted yellow.
//   1 Mesita Places — the closest N listed Mesita (partners + enriched).
//     No Google Nearby. A partner in that N is painted yellow.
//   2 Google Places — the closest N Nearby hits too. A hit that is
//     Mesita / partner is painted, not added as a second pin. Max pins
//     = N, never the sum of the lanes.
// N is the GUEST's How many (Pato, 2026-08-29) — the max number is asked
// once, on the consumer Filters sheet, never again in the console.
// Empty Nearby (quota skip) falls back to the Mesita set. Power 1
// never fires Google Nearby. Mesita Places is enriched only. Google
// maxes a Nearby call at 20; type batteries ride that one call.

import {
  GOOGLE_PLACES_NEARBY_URL,
  classifyGoogleError,
} from "./google-places.ts";
import { isPaidPlan } from "./membership-enforcement-helpers.ts";
import {
  haversineKm,
  NEARBY_RADIUS_KM,
  takeClosest,
} from "./geo.ts";
import { GOOGLE_SEARCH_TYPES } from "./google-type-super.ts";

/** Google maxes one Nearby call at 20 — the API's cap, not a policy. */
export const GOOGLE_NEARBY_MAX = 20;
/** The guest's largest How many stop. Every lane cap clamps to it. */
export const CATALOG_NEARBY_HARD_MAX = 60;
export const MESITA_NEARBY_MAX = CATALOG_NEARBY_HARD_MAX;
export const CATALOG_NEARBY_MAX = CATALOG_NEARBY_HARD_MAX;
/** Mesita rows admitted from the 50 km box before distance rank. Not newest-N:
 *  a close listed place that is older than 200 newer rows in the city must
 *  still compete for its Partner / Mesita slot so merge can keep the listed pin. */
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
  /** Nearby primary types. Omit = the five F&B batteries. Empty = no
   *  Google call. Super-driven search may send GOOGLE_SEARCH_TYPES
   *  (spa, museum, park, …) beyond the five. */
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

const SUPER_SEARCH_TYPE_SET = new Set<string>(
  Object.values(GOOGLE_SEARCH_TYPES).flat(),
);

function resolveNearbyTypes(types?: readonly string[]): readonly string[] {
  if (!types) return NEARBY_TYPES;
  return types.filter((t) => SUPER_SEARCH_TYPE_SET.has(t));
}

/** Closest Google places around `center`. One Nearby Search (New) with
 *  the enabled primary types, max 20, DISTANCE rank. Same ~1 km
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
  mesitaCount: number;
  googleCount: number;
};

export type NearbyMerged<T> =
  | { kind: "listed"; row: T }
  | { kind: "google"; hit: NearbyHit };

/**
 * Search power: 1 Mesita Places set · 2 Google Places set. A legacy wire
 * 3 (the old Google set) clamps to 2; the retired Partners power (old 1)
 * reads as Mesita Places — a superset of what it showed.
 */
export function clampSearchPower(value: unknown): 1 | 2 {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 1;
  return n >= 2 ? 2 : 1;
}

/**
 * Lane caps come from the GUEST's How many, not from a console knob
 * (Pato, 2026-08-29): the max number is asked once, on the consumer
 * Filters sheet. Power 1 never fires Google. Google's own Nearby call
 * tops out at GOOGLE_NEARBY_MAX however large N is, and the caller
 * slices the merged union back to N, so max pins = N, never the sum.
 */
export function lanesForSearchPower(
  power: 1 | 2,
  limit: number,
): NearbyLaneCaps {
  const n = Math.max(
    0,
    Math.min(CATALOG_NEARBY_HARD_MAX, Math.round(Number(limit) || 0)),
  );
  return {
    mesitaCount: n,
    googleCount: power >= 2 ? Math.min(n, GOOGLE_NEARBY_MAX) : 0,
  };
}

/** Mesita Places on Search: enriched profile, not a Created stub. */
export function isEnrichedListedRow(row: {
  content_status?: string | null;
  enriched_at?: string | null;
}): boolean {
  return row.content_status === "ready" || Boolean(row.enriched_at);
}

/** The Mesita set at any power: partners always stay, everyone else enriched only. */
export function keepListedForSearchPower(
  row: MesitaNearbyRow & {
    content_status?: string | null;
    enriched_at?: string | null;
  },
): boolean {
  if (isMesitaPartnerRow(row)) return true;
  return isEnrichedListedRow(row);
}

/** Place IDs already on a listed row — paint helpers, not a second query. */
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
  lanes: NearbyLaneCaps = lanesForSearchPower(2, CATALOG_NEARBY_HARD_MAX),
): Array<NearbyMerged<T>> {
  const inCircle = (lat: number | null, lng: number | null) =>
    haversineKm(center.lat, center.lng, lat, lng) <= NEARBY_RADIUS_KM;
  const inMesita = mesita.filter((row) => inCircle(row.lat ?? null, row.lng ?? null));
  const inGoogle = google.filter((hit) => inCircle(hit.lat, hit.lng));

  if (lanes.googleCount > 0 && inGoogle.length > 0) {
    const hits = takeClosest(inGoogle, center, lanes.googleCount);
    const byGid = new Map<string, T>();
    for (const row of inMesita) {
      if (row.google_place_id && !byGid.has(row.google_place_id)) {
        byGid.set(row.google_place_id, row);
      }
    }
    return hits.map((hit) => {
      const row = byGid.get(hit.placeId);
      if (row) return { kind: "listed" as const, row };
      return { kind: "google" as const, hit };
    });
  }

  return takeClosest(inMesita, center, lanes.mesitaCount).map((row) => ({
    kind: "listed" as const,
    row,
  }));
}
