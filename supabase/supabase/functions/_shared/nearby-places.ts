// Map catalog = closest N of the selected Places set, then paint.
// THREE NESTED SETS (Pato, 2026-09-05):
//   Google Places ⊃ Mesita Enriched Places ⊃ Mesita Partner Places
//   partners  the closest N Mesita rows that are enriched AND pay.
//   mesita    the closest N enriched Mesita rows, partners among them.
//             No Google Nearby.
//   google    the closest N Nearby hits too. A hit that is Mesita is
//             painted, not added as a second pin. Max pins = N, never
//             the sum of the lanes.
// ENRICHMENT GATES EVERY MESITA RING, which is what makes the chain a
// containment rather than a drawing: a partner that is not enriched is in
// neither Mesita ring and reads gray until it is.
// N is the GUEST's How many (Pato, 2026-08-29) — the max number is asked
// once, on the consumer Filters sheet, never again in the console.
// Empty Nearby (quota skip) falls back to the Mesita set. Only the Google
// ring fires Nearby, and callers gate that on the lane cap. Google
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
import { NEARBY_TYPE_KEYS, type NearbyTypeKey } from "./discovery-config.ts";

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

// DERIVED, never a second list. This was its own five-key literal and drifted
// out of lockstep the moment discovery_config grew (MESITA-1683); the test
// below that pinned them together is now true by construction.
export const NEARBY_TYPES = NEARBY_TYPE_KEYS;

export type NearbyType = NearbyTypeKey;

export type NearbyHit = {
  placeId: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  primaryType: string | null;
  /** Google's own label. Feeds Discovery › General's post-Google wipe. */
  businessStatus: string | null;
  reviewCount: number | null;
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
        "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.businessStatus,places.primaryType",
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
      userRatingCount?: number;
      businessStatus?: string;
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
        businessStatus: typeof p.businessStatus === "string"
          ? p.businessStatus
          : null,
        reviewCount: typeof p.userRatingCount === "number"
          ? p.userRatingCount
          : null,
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
  pull?: number,
): NearbyHit[] | null {
  const hit = nearbyCache.get(
    nearbyCellKey(center, resolveNearbyTypes(types), pull ?? GOOGLE_NEARBY_MAX),
  );
  if (hit && Date.now() - hit.at < NEARBY_CACHE_MS) return hit.hits;
  return null;
}

export type SearchNearbyOpts = {
  radiusM?: number;
  /**
   * How many places to pull: 20, 40 or 60 (`discovery_config.map.googlePull`).
   * Google caps ONE Nearby Search (New) at 20 and offers no page token, so 40
   * and 60 are 2 and 3 BILLED requests over disjoint slices of the battery,
   * deduped by placeId. Omit = 20 = one call, today's behaviour.
   */
  pull?: number;
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
  pull: number = GOOGLE_NEARBY_MAX,
): string {
  return `${center.lat.toFixed(2)},${center.lng.toFixed(2)}:${
    nearbyTypesKey(types)
  }:p${pull}`;
}

/** Requests one pull costs. 20 → 1, 40 → 2, 60 → 3; never more than 3. */
export function nearbyCallCount(pull: number | undefined): number {
  const n = Math.ceil((Number(pull) || GOOGLE_NEARBY_MAX) / GOOGLE_NEARBY_MAX);
  return Math.min(3, Math.max(1, n));
}

/**
 * Split the battery into `calls` disjoint slices, round-robin so each slice
 * spans Supers rather than taking the first N types. A battery with fewer
 * types than calls yields fewer slices — one type cannot be searched twice for
 * two different answers, so a single-Super pull is 20 no matter what the
 * operator picked. The console says so on the box.
 */
export function sliceNearbyTypes(
  types: readonly string[],
  calls: number,
): string[][] {
  const groups = Math.min(Math.max(1, calls), types.length);
  if (groups <= 1) return [[...types]];
  const out: string[][] = Array.from({ length: groups }, () => []);
  types.forEach((t, i) => out[i % groups].push(t));
  return out;
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
  const calls = nearbyCallCount(parsed.pull);
  const key = nearbyCellKey(center, types, parsed.pull ?? GOOGLE_NEARBY_MAX);
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
    const slices = sliceNearbyTypes(types, calls);
    const seen = new Set<string>();
    const hits: NearbyHit[] = [];
    let anyOk = false;
    for (const [i, slice] of slices.entries()) {
      if (i > 0) {
        pruneGoogleFanout(Date.now());
        if (googleFanoutAt.length >= GOOGLE_FANOUT_MAX) {
          console.warn("[nearby] isolate Google fan-out budget exhausted mid-pull");
          break;
        }
      }
      googleFanoutAt.push(Date.now());
      const batch = await searchNearbyOnce(apiKey, center, radius, slice);
      if (!batch.ok) continue;
      anyOk = true;
      for (const hit of batch.hits) {
        if (seen.has(hit.placeId)) continue;
        seen.add(hit.placeId);
        hits.push(hit);
      }
    }
    // Only a clean pull is cached; a slice that failed would freeze a short
    // list into the cell for 15s and hide places the retry would have found.
    if (anyOk) nearbyCache.set(key, { at: Date.now(), hits });
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
 * THREE NESTED SETS (Pato, 2026-09-05):
 *
 *   Google Places  ⊃  Mesita Enriched Places  ⊃  Mesita Partner Places
 *      gray                    red                     yellow
 *
 * The wire carries the set by NAME, never by an ordinal. Two clients post
 * no scope at all — mobile Search and the web Pay picker — so the absent
 * value has to be safe on its own, and an ordinal whose meaning moved
 * would have narrowed both of them silently. Unknown and absent alike
 * resolve to `mesita`: the widest Mesita ring, never the narrowest.
 *
 * Legacy numerics keep their OLD shipped meanings (1 = Mesita, 2 = Google,
 * 3 = Google) so a client deployed before this EF still gets the set it
 * asked for. Vercel and the Edge Functions deploy on separate paths, so
 * that skew window is real, not hypothetical.
 */
export type PlacesScope = "partners" | "mesita" | "google";

export const PLACES_SCOPE_DEFAULT: PlacesScope = "mesita";

const PLACES_SCOPES: readonly PlacesScope[] = ["partners", "mesita", "google"];

export function parsePlacesScope(value: unknown): PlacesScope {
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    if ((PLACES_SCOPES as readonly string[]).includes(key)) {
      return key as PlacesScope;
    }
    // A legacy numeric arriving as a string reads the same as the number.
    const legacy = Number(key);
    if (Number.isFinite(legacy) && key.length > 0) {
      return legacy >= 2 ? "google" : PLACES_SCOPE_DEFAULT;
    }
    return PLACES_SCOPE_DEFAULT;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 2 ? "google" : PLACES_SCOPE_DEFAULT;
  }
  return PLACES_SCOPE_DEFAULT;
}

/**
 * Lane caps come from the GUEST's How many, not from a console knob
 * (Pato, 2026-08-29): the max number is asked once, on the consumer
 * Filters sheet. Only the Google scope fires Nearby — and callers gate
 * that call on `googleCount > 0`, never on the scope name, so there is one
 * place to change and no literal to miss. The Google lane also cannot exceed
 * the OPERATOR's pull (`discovery_config.map.googlePull`, 20/40/60 — how many
 * Google rows we are willing to pay for), and the caller slices the merged
 * union back to N, so max pins = N, never the sum.
 */
export function lanesForPlacesScope(
  scope: PlacesScope,
  limit: number,
  pull: number = GOOGLE_NEARBY_MAX,
): NearbyLaneCaps {
  const n = Math.max(
    0,
    Math.min(CATALOG_NEARBY_HARD_MAX, Math.round(Number(limit) || 0)),
  );
  return {
    mesitaCount: n,
    googleCount: scope === "google"
      ? Math.min(n, Math.max(GOOGLE_NEARBY_MAX, Math.round(Number(pull) || 0)))
      : 0,
  };
}

/** Mesita Places on Search: enriched profile, not a Created stub. */
export function isEnrichedListedRow(row: {
  content_state?: string | null;
  enriched_at?: string | null;
}): boolean {
  return row.content_state === "ready" || Boolean(row.enriched_at);
}

/**
 * ENRICHMENT GATES EVERY MESITA RING (Pato, 2026-09-05). The sets are
 * strictly nested, so a partner has to clear the enriched ring before it
 * can sit inside it — this used to keep any partner regardless, which made
 * `Partner ⊂ Enriched` false and left the diagram asserting a containment
 * the predicate refused. An unenriched partner now reads gray until it is
 * enriched, which is what "Red is EARNED by enrichment" already said.
 *
 * The Google scope keeps the same Mesita rows: a wider ring never shows
 * FEWER Mesita places, it only adds Google ones alongside them.
 */
export function keepListedForScope(
  row: MesitaNearbyRow & {
    content_state?: string | null;
    enriched_at?: string | null;
  },
  scope: PlacesScope = PLACES_SCOPE_DEFAULT,
): boolean {
  if (!isEnrichedListedRow(row)) return false;
  return scope === "partners" ? isMesitaPartnerRow(row) : true;
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
  lanes: NearbyLaneCaps = lanesForPlacesScope("google", CATALOG_NEARBY_HARD_MAX),
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
