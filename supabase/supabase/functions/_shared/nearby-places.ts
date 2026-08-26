// Map catalog = Google Nearby Search (New) plus listed Mesita rows in the
// same 50 km circle. Rank by distance from the camera (or guest) center.
// Product cap 50. Google maxes each Nearby call at 20, so we fan out one
// request per food/drink primary type and merge unique Place IDs.

import {
  GOOGLE_PLACES_NEARBY_URL,
  classifyGoogleError,
} from "./google-places.ts";
import { haversineKm, NEARBY_RADIUS_KM, takeClosest } from "./geo.ts";

export const CATALOG_NEARBY_MAX = 50;
export const GOOGLE_NEARBY_MAX = 20;
/** Mesita rows admitted from the 50 km box before distance rank. Not newest-N:
 *  a close listed place that is older than 200 newer rows in the city must
 *  still win its Google Place ID, or it reappears as a yellow stub. */
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
/** Per-isolate cap on Google fan-outs (five Nearby calls each). Isolates do
 *  not share this; it still bounds one spray against a warm isolate. */
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
  /** Subset of NEARBY_TYPES. Omit = all five. Empty = no Google calls. */
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

/** Closest Google food/drink places around `center`. Deduped by Place ID.
 *  Same ~1 km cell reuses a successful 15s result so a pan-idle does not
 *  spend five billed Nearby calls twice. HTTP / parse failures are returned
 *  (Mesita fill still shows) but never cached — a blip must not lock the
 *  cell on an empty Google rail. Concurrent same-cell pans share one fan-out.
 *  Each isolate also caps cache-miss fan-outs (20 / 60s). Shared IP quota
 *  is `beforeFanout` (nearby-google-quota.ts), not a pre-call in list-places. */
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
    const batches = await Promise.all(
      types.map((type) =>
        searchNearbyOnce(apiKey, center, radius, [type]),
      ),
    );
    const byId = new Map<string, NearbyHit>();
    let allOk = true;
    for (const batch of batches) {
      if (!batch.ok) {
        allOk = false;
        continue;
      }
      for (const row of batch.hits) {
        if (!byId.has(row.placeId)) byId.set(row.placeId, row);
      }
    }
    const hits = [...byId.values()];
    if (allOk) nearbyCache.set(key, { at: Date.now(), hits });
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
};

export type NearbyMerged<T> =
  | { kind: "listed"; row: T }
  | { kind: "google"; hit: NearbyHit };

export function mergeNearbyCatalog<T extends MesitaNearbyRow>(
  mesita: T[],
  google: NearbyHit[],
  center: { lat: number; lng: number },
  limit = CATALOG_NEARBY_MAX,
): Array<NearbyMerged<T>> {
  const byGoogleId = new Map<string, T>();
  for (const row of mesita) {
    const gid = row.google_place_id;
    if (gid) byGoogleId.set(gid, row);
  }
  const extraGoogle = google.filter((hit) => !byGoogleId.has(hit.placeId));
  const inCircle = (lat: number | null, lng: number | null) =>
    haversineKm(center.lat, center.lng, lat, lng) <= NEARBY_RADIUS_KM;
  const combined = [
    ...mesita.map((row) => ({
      kind: "listed" as const,
      row,
      lat: row.lat ?? null,
      lng: row.lng ?? null,
    })),
    ...extraGoogle.map((hit) => ({
      kind: "google" as const,
      hit,
      lat: hit.lat,
      lng: hit.lng,
    })),
  ].filter((item) => inCircle(item.lat, item.lng));
  return takeClosest(combined, center, limit).map((item) =>
    item.kind === "listed"
      ? { kind: "listed" as const, row: item.row }
      : { kind: "google" as const, hit: item.hit }
  );
}
