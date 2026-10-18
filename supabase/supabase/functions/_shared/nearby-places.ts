// Map catalog = the nearest N of the guest's one scope, then paint.
// TWO GUEST SCOPES (MESITA-2298) over the three nested sets
// (Google Places ⊃ Mesita Places ⊃ Mesita Enriched Places):
//   enriched  Mesita Selected — the nearest N enriched Mesita rows. No
//             Google Nearby.
//   google    Google Places — every Selected row plus the nearest Nearby
//             hits. A hit that is Mesita is painted, not added as a second
//             pin. Max pins = N, never the sum of the lanes.
//   (`mesita`, the Created-rows ring, has no guest word any more; the
//   parser lands it on `enriched`.)
// N is operator `map.pinCount`. ONE Nearby Search (New) call per cache-miss
// cell: maxResultCount 20, DISTANCE, the enabled primary types, inside the
// operator's radius; never a second page, never a wider circle. Empty
// Nearby (quota skip) falls back to the Mesita set. Only the Google scope
// fires Nearby, and callers gate that on the lane cap.

import {
  classifyGoogleError,
  GOOGLE_PLACES_NEARBY_URL,
  stripPlacesPrefix,
} from "./google-places.ts";
import { haversineKm, NEARBY_RADIUS_KM, takeClosest } from "./geo.ts";
import { GOOGLE_SEARCH_TYPES } from "./google-type-super.ts";
import { NEARBY_TYPE_KEYS } from "./discovery-config.ts";
import { isPlaceEnriched, isPlaceProfileReady } from "./place-state.ts";

/** Nearby Search (New) caps one POST at maxResultCount 20 with no page
 *  token, and the engine never asks twice (MESITA-2298). */
export const GOOGLE_NEARBY_MAX = 20;
/** The largest How many stop. Every lane cap clamps to it. */
export const CATALOG_NEARBY_HARD_MAX = 60;
export const GOOGLE_NEARBY_RADIUS_M = NEARBY_RADIUS_KM * 1000;
/** The operator's circle, in metres, clamped to what Nearby accepts
 *  (50 m .. 50 km). `map.radiusKm` is 1..50; a bad value reads as 50 km. */
export function nearbyRadiusMetres(radiusKm?: number): number {
  const km = typeof radiusKm === "number" && Number.isFinite(radiusKm) &&
      radiusKm > 0
    ? radiusKm
    : NEARBY_RADIUS_KM;
  return Math.min(50_000, Math.max(50, Math.round(km * 1000)));
}
const NEARBY_CACHE_MS = 15_000;
/** Feed › Right Now's cell TTL (MESITA-2295). "Open now" moves slowly, so a
 *  cell is reused for minutes, not Search's 15 s. */
export const RIGHT_NOW_CACHE_MS = 5 * 60_000;
const NEARBY_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.businessStatus,places.primaryType";
/** Right Now's mask: Search's, plus open-now. Never a photo field: a card
 *  for an ephemeral Google result draws a placeholder (MESITA-2298). */
const RIGHT_NOW_FIELD_MASK =
  `${NEARBY_FIELD_MASK},places.currentOpeningHours.openNow`;

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
  /** Right Now only: Google's `currentOpeningHours.openNow`. */
  openNow?: boolean | null;
};

type NearbyOnce =
  | { ok: true; hits: NearbyHit[] }
  | { ok: false };

async function searchNearbyOnce(
  apiKey: string,
  center: { lat: number; lng: number },
  radiusM: number,
  includedPrimaryTypes: string[],
  rightNow = false,
): Promise<NearbyOnce> {
  const r = await fetch(GOOGLE_PLACES_NEARBY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": rightNow ? RIGHT_NOW_FIELD_MASK : NEARBY_FIELD_MASK,
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
      currentOpeningHours?: { openNow?: boolean };
    }>;
  };
  const hits = (data.places ?? [])
    .map((p): NearbyHit => {
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
        ...(rightNow
          ? {
            openNow: typeof p.currentOpeningHours?.openNow === "boolean"
              ? p.currentOpeningHours.openNow
              : null,
          }
          : {}),
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
  googleFanoutAt = googleFanoutAt.filter((at) =>
    now - at < GOOGLE_FANOUT_WINDOW_MS
  );
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
  rightNow = false,
  radiusKm?: number,
): NearbyHit[] | null {
  const hit = nearbyCache.get(
    nearbyCellKey(
      center,
      resolveNearbyTypes(types),
      rightNow,
      nearbyRadiusMetres(radiusKm),
    ),
  );
  if (hit && Date.now() - hit.at < nearbyCacheMs(rightNow)) return hit.hits;
  return null;
}

function nearbyCacheMs(rightNow: boolean): number {
  return rightNow ? RIGHT_NOW_CACHE_MS : NEARBY_CACHE_MS;
}

export type SearchNearbyOpts = {
  /** Nearby primary types. Omit = the five F&B batteries. Empty = no
   *  Google call. Super-driven search may send GOOGLE_SEARCH_TYPES
   *  (spa, museum, park, …) beyond the five. */
  types?: readonly string[];
  /**
   * Called once, right before the ONE billed Nearby call (MESITA-1700): the
   * ledger behind this hook counts what Google charges for. `false` skips
   * Google for this cell; nothing is cached.
   */
  beforeFanout?: () => Promise<boolean>;
  /** The operator's circle (`map.radiusKm`, MESITA-2298 §3). Omit = 50 km.
   *  Part of the cache cell: two radii are two answers. */
  radiusKm?: number;
  /**
   * Feed › Right Now (MESITA-2295): the one New POST, whose mask
   * adds `currentOpeningHours.openNow` + `photos`, cached in its own cell
   * for RIGHT_NOW_CACHE_MS. Search never sets it, so its mask, SKU and 15 s
   * cell are untouched.
   */
  rightNow?: boolean;
};

function nearbyTypesKey(types: readonly string[]): string {
  return [...types].sort().join(",") || "none";
}

function nearbyCellKey(
  center: { lat: number; lng: number },
  types: readonly string[] = NEARBY_TYPE_KEYS,
  rightNow = false,
  radiusM: number = GOOGLE_NEARBY_RADIUS_M,
): string {
  return `${center.lat.toFixed(2)},${center.lng.toFixed(2)}:${
    nearbyTypesKey(types)
  }:r${radiusM}${rightNow ? ":now" : ""}`;
}

const SUPER_SEARCH_TYPE_SET = new Set<string>(
  Object.values(GOOGLE_SEARCH_TYPES).flat(),
);

function resolveNearbyTypes(types?: readonly string[]): readonly string[] {
  if (!types) return NEARBY_TYPE_KEYS;
  return types.filter((t) => SUPER_SEARCH_TYPE_SET.has(t));
}

/** The nearest Google places around `center`: ONE Nearby Search (New) POST
 *  with every enabled primary type, maxResultCount 20, DISTANCE rank
 *  (MESITA-2298). Never a second page, never a wider circle. Same ~1 km cell
 *  reuses a successful 15s result. HTTP / parse failures are returned
 *  (Mesita still shows) but never cached. Concurrent same-cell pans share one
 *  in-flight call. Each isolate also caps cache-miss calls (20 / 60s). Shared
 *  IP quota is `beforeFanout` (nearby-google-quota.ts), charged once per
 *  billed call. */
export async function searchNearbyPlaces(
  apiKey: string,
  center: { lat: number; lng: number },
  opts: SearchNearbyOpts = {},
): Promise<NearbyHit[]> {
  const radius = nearbyRadiusMetres(opts.radiusKm);
  const beforeFanout = opts.beforeFanout;
  const types = resolveNearbyTypes(opts.types);
  if (types.length === 0) return [];
  const rightNow = opts.rightNow === true;
  const key = nearbyCellKey(center, types, rightNow, radius);
  const hit = nearbyCache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < nearbyCacheMs(rightNow)) return hit.hits;
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
    googleFanoutAt.push(Date.now());

    const batch = await searchNearbyOnce(
      apiKey,
      center,
      radius,
      [...types],
      rightNow,
    );
    if (!batch.ok) {
      resolveRun([]);
      return [];
    }
    const seen = new Set<string>();
    const hits: NearbyHit[] = [];
    for (const hit of batch.hits) {
      if (seen.has(hit.placeId)) continue;
      seen.add(hit.placeId);
      hits.push(hit);
    }

    nearbyCache.set(key, { at: Date.now(), hits });
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

export type NearbyLaneCaps = {
  mesitaCount: number;
  googleCount: number;
};

export type NearbyMerged<T> =
  | { kind: "listed"; row: T }
  | { kind: "google"; hit: NearbyHit };

/**
 * THREE NESTED SETS (MESITA-2158):
 *
 *   Google Places  ⊃  Mesita Places  ⊃  Mesita Enriched Places
 *      gray              ink                 red
 *
 * The wire carries the set by NAME, never by an ordinal. A caller that
 * posts no scope must be safe on its own, and an ordinal whose meaning
 * moved would narrow it silently. Unknown and absent alike resolve to
 * `mesita`, the widest Mesita ring. `enriched` is the inner ring's word;
 * a client from before it existed sends `mesita` and now gets the wider
 * set, Created places included, which is harmless.
 *
 * Legacy numerics keep their OLD shipped meanings (1 = Mesita, 2 = Google,
 * 3 = Google) so a client deployed before this EF still gets the set it
 * asked for. Vercel and the Edge Functions deploy on separate paths, so
 * that skew window is real, not hypothetical.
 */
export type PlacesScope = "enriched" | "mesita" | "google";

/**
 * The guest has two scopes (MESITA-2298): `google` (Google Places) and
 * `selected` (Mesita Selected = the enriched, ready set, `enriched` here).
 * The retired `mesita` word and the absent value both land on Selected:
 * there is no Created-rows scope a guest can ask for any more.
 */
export const PLACES_SCOPE_DEFAULT: PlacesScope = "enriched";

const PLACES_SCOPES: readonly PlacesScope[] = ["enriched", "mesita", "google"];

export function parsePlacesScope(value: unknown): PlacesScope {
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    if (key === "selected" || key === "mesita") return "enriched";
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
 * Lane caps come from operator `map.pinCount` (`limit`). Only the Google
 * scope fires Nearby — and callers gate that call on `googleCount > 0`,
 * never on the scope name, so there is one place to change and no literal
 * to miss. Google hands back at most 20 per call and the engine never asks
 * twice (MESITA-2298), so the Google lane is at most 20 and, with hits in
 * hand, the Google scope IS those hits (MESITA-2310); `mesitaCount` caps
 * the Mesita set the empty-Nearby fallback shows. The caller slices the
 * result back to N, so max pins = N, never the sum.
 */
export function lanesForPlacesScope(
  scope: PlacesScope,
  limit: number,
): NearbyLaneCaps {
  const n = Math.max(
    0,
    Math.min(CATALOG_NEARBY_HARD_MAX, Math.round(Number(limit) || 0)),
  );
  return {
    mesitaCount: n,
    googleCount: scope === "google" ? Math.min(n, GOOGLE_NEARBY_MAX) : 0,
  };
}

/**
 * The inner ring's half of the gate: enriched profile, not a Created stub.
 * "Red is EARNED by enrichment" (Pato, 2026-09-05).
 *
 * Enriched = an Enrich run completed = `enriched_at` set (MESITA-2154) — the
 * same {@link isPlaceEnriched} every reader uses. A Created place is
 * `content_state = 'ready'` with a null stamp: in Mesita Places, never in
 * Mesita Enriched Places.
 */
export function isEnrichedListedRow(row: {
  enriched_at?: string | null;
}): boolean {
  return isPlaceEnriched(row.enriched_at);
}

/**
 * Mesita Places: a listed row (RLS already limits the read to
 * `state = 'active'`) whose profile can be shown now — `content_state =
 * 'ready'`, which Create saves too. Enriched or not.
 */
export function isMesitaListedRow(row: {
  content_state?: string | null;
}): boolean {
  return isPlaceProfileReady(row.content_state);
}

/**
 * Which Mesita rows a scope admits. `enriched` is the `mesita` ring cut to
 * the rows an Enrich run completed. `google` admits the same rows as
 * `mesita` but SHOWS only the ones Google returned, as their owners
 * (`mergeNearbyCatalog`, MESITA-2310): Mesita Selected is a subset of
 * Google Places, never a lane beside it.
 */
export function admitsScopeRow(
  scope: PlacesScope,
  row: { content_state?: string | null; enriched_at?: string | null },
): boolean {
  if (!isMesitaListedRow(row)) return false;
  return scope === "enriched" ? isEnrichedListedRow(row) : true;
}

/** The row fields {@link claimOwnedHits} reads. */
export type OwnedNearbyRow = {
  google_place_id?: string | null;
  enriched_at?: string | null;
};

/** What {@link claimOwnedHits} decided about the Google hits Mesita owns. */
export type OwnedHitClaim<T> = {
  /** The hits that may merge: Google-only ones, the ring's own, Created ones. */
  hits: NearbyHit[];
  /** Created (not enriched) rows a ring cut left out: each paints its hit,
   *  as a Mesita row, in the hit's slot. */
  paintByGid: Map<string, T>;
  /** Every google_place_id a Mesita row carries, ring and owned alike. */
  ownedGids: Set<string>;
};

function gidOf(row: OwnedNearbyRow): string | null {
  const gid = row.google_place_id?.trim();
  return gid ? gid : null;
}

/**
 * A Google hit Mesita already owns is NEVER sent as a `g:` stub (MESITA-2154).
 *
 * The stub's "Add to Mesita" button posts consumer-web-create-place, which
 * 409s `place_already_exists` for a google_place_id Mesita holds, and the
 * guest gets a toast instead of the place. So a hit whose google_place_id a
 * listed Mesita row carries resolves one of three ways:
 *
 *   ring   the row is in the scope's Mesita rows (on the Google ring that
 *          is every ready Mesita row, Created ones included — MESITA-2158):
 *          the hit passes and merge pairs it with the row.
 *   paint  the row is NOT enriched (a Created place) and a ring cut left it
 *          out: the hit passes and goes out as that Mesita row, ink, in the
 *          hit's slot. Created places stay reachable here, with the guest
 *          Enrich vote, whatever their stored family_keys or review count
 *          say — the hit already cleared the Google-side cuts.
 *   drop   the row IS enriched but a ring cut left it out (the General gate,
 *          a Map floor, the guest's Popularity or Super on stored keys, a
 *          profile that is not ready): the hit is removed, so every red row
 *          on the map has passed every ring cut.
 *
 * `owned` must come from an UNFILTERED google_place_id lookup (RLS already
 * limits it to listed rows): a lookup that carries the ring cuts is exactly
 * how a cut Created row used to fall through to a stub.
 */
export function claimOwnedHits<T extends OwnedNearbyRow>(
  hits: readonly NearbyHit[],
  owned: readonly T[],
  ring: readonly T[],
): OwnedHitClaim<T> {
  const ringGids = new Set<string>();
  for (const row of ring) {
    const gid = gidOf(row);
    if (gid) ringGids.add(gid);
  }
  const ownedGids = new Set(ringGids);
  const paintByGid = new Map<string, T>();
  const dropGids = new Set<string>();
  for (const row of owned) {
    const gid = gidOf(row);
    if (!gid) continue;
    ownedGids.add(gid);
    if (ringGids.has(gid)) continue;
    if (!isPlaceEnriched(row.enriched_at)) {
      if (!paintByGid.has(gid)) paintByGid.set(gid, row);
      dropGids.delete(gid);
    } else if (!paintByGid.has(gid)) {
      dropGids.add(gid);
    }
  }
  return {
    hits: hits.filter((hit) => !dropGids.has(hit.placeId)),
    paintByGid,
    ownedGids,
  };
}

/** How one merged `google` item goes out on the wire. */
export type GoogleItemRow<T> =
  | { kind: "mesita"; row: T }
  | { kind: "stub" }
  | { kind: "drop" };

/**
 * The last word on a merged `google` item: its painting Created row, else a
 * stub — unless Mesita owns the gid, in which case it is dropped. That last
 * case is a ring row that a later JS cut removed after {@link claimOwnedHits}
 * let its hit through; it still must not become a stub.
 */
export function resolveGoogleItem<T>(
  hit: NearbyHit,
  claim: OwnedHitClaim<T>,
): GoogleItemRow<T> {
  const painted = claim.paintByGid.get(hit.placeId);
  if (painted) return { kind: "mesita", row: painted };
  if (claim.ownedGids.has(hit.placeId)) return { kind: "drop" };
  return { kind: "stub" };
}

export function mergeNearbyCatalog<T extends MesitaNearbyRow>(
  mesita: T[],
  google: NearbyHit[],
  center: { lat: number; lng: number },
  lanes: NearbyLaneCaps = lanesForPlacesScope(
    "google",
    CATALOG_NEARBY_HARD_MAX,
  ),
  radiusKm: number = NEARBY_RADIUS_KM,
): Array<NearbyMerged<T>> {
  const inCircle = (lat: number | null, lng: number | null) =>
    haversineKm(center.lat, center.lng, lat, lng) <= radiusKm;
  const inMesita = mesita.filter((row) =>
    inCircle(row.lat ?? null, row.lng ?? null)
  );
  const inGoogle = google.filter((hit) => inCircle(hit.lat, hit.lng));

  if (lanes.googleCount > 0 && inGoogle.length > 0) {
    const hits = takeClosest(inGoogle, center, lanes.googleCount);
    const byGid = new Map<string, T>();
    for (const row of inMesita) {
      if (row.google_place_id && !byGid.has(row.google_place_id)) {
        byGid.set(row.google_place_id, row);
      }
    }
    // The Google scope is what Google returned: its nearest hits, each one
    // Mesita owns going out as that row. A Mesita place Google did not
    // return is not in this scope — no backfill up to `mesitaCount`, so a
    // far red pin never sits beside the gray cluster (MESITA-2310; Pato:
    // Mesita Selected is a subset of Google Places, never a lane beside it).
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
