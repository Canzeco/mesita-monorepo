// Map catalog = closest N of the selected Places set, then paint.
// THREE NESTED SETS (MESITA-2158):
//   Google Places ⊃ Mesita Places ⊃ Mesita Enriched Places
//   enriched  the closest N enriched Mesita rows. No Google Nearby.
//   mesita    the closest N Mesita rows a guest can reach (profile
//             ready), enriched or not. No Google Nearby.
//   google    every Mesita row of the `mesita` ring plus the closest N
//             Nearby hits. A hit that is Mesita is painted, not added as a
//             second pin. Max pins = N, never the sum of the lanes.
// ENRICHMENT GATES ONLY THE INNER RING: a Created place is in Mesita
// Places and reads ink; it turns red when an Enrich run completes.
// N is the GUEST's How many (Pato, 2026-08-29) — the max number is asked
// once, on the consumer Filters sheet, never again in the console.
// Empty Nearby (quota skip) falls back to the Mesita set. Only the Google
// ring fires Nearby, and callers gate that on the lane cap. Google
// maxes a Nearby call at 20; type batteries ride that one call.

import {
  classifyGoogleError,
  GOOGLE_PLACES_NEARBY_LEGACY_URL,
  GOOGLE_PLACES_NEARBY_URL,
  stripPlacesPrefix,
} from "./google-places.ts";
import { haversineKm, NEARBY_RADIUS_KM, takeClosest } from "./geo.ts";
import { GOOGLE_SEARCH_TYPES } from "./google-type-super.ts";
import { NEARBY_TYPE_KEYS } from "./discovery-config.ts";
import { isPlaceEnriched, isPlaceProfileReady } from "./place-state.ts";

/** Google bills Nearby in pages of 20. Legacy paginates with next_page_token
 *  (3 pages = 60); New caps one POST at maxResultCount 20 with no page token. */
export const GOOGLE_NEARBY_MAX = 20;
/** Legacy pagetoken is invalid until Google finishes indexing the prior page. */
const LEGACY_PAGE_TOKEN_DELAY_MS = 2_000;
let legacyPageTokenDelayMs = LEGACY_PAGE_TOKEN_DELAY_MS;
/** The guest's largest How many stop. Every lane cap clamps to it. */
export const CATALOG_NEARBY_HARD_MAX = 60;
export const GOOGLE_NEARBY_RADIUS_M = NEARBY_RADIUS_KM * 1000;
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

type LegacyNearbyPage =
  | { ok: true; hits: NearbyHit[]; nextPageToken?: string }
  | { ok: false };

function primaryTypeFromLegacy(
  types: string[] | undefined,
  allowed: readonly string[],
): string | null {
  if (!types?.length) return null;
  const allowedSet = new Set(allowed);
  for (const t of types) {
    if (allowedSet.has(t)) return t;
  }
  return null;
}

function legacyResultMatchesTypes(
  types: string[] | undefined,
  allowed: readonly string[],
): boolean {
  return primaryTypeFromLegacy(types, allowed) !== null;
}

async function searchNearbyLegacyPage(
  apiKey: string,
  center: { lat: number; lng: number },
  radiusM: number,
  allowedTypes: readonly string[],
  pageToken?: string,
): Promise<LegacyNearbyPage> {
  const params = new URLSearchParams({ key: apiKey });
  if (pageToken) {
    params.set("pagetoken", pageToken);
  } else {
    params.set("location", `${center.lat},${center.lng}`);
    params.set("radius", String(Math.min(50_000, Math.max(50, radiusM))));
  }
  const r = await fetch(`${GOOGLE_PLACES_NEARBY_LEGACY_URL}?${params}`);
  if (!r.ok) {
    const text = await r.text();
    const code = classifyGoogleError(r.status, text);
    console.error("[nearby] Google legacy nearby failed", code, r.status);
    return { ok: false };
  }
  const data = (await r.json()) as {
    status?: string;
    results?: Array<{
      place_id?: string;
      name?: string;
      vicinity?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
      rating?: number;
      user_ratings_total?: number;
      business_status?: string;
      types?: string[];
    }>;
    next_page_token?: string;
  };
  if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.error("[nearby] Google legacy nearby status", data.status);
    return { ok: false };
  }
  const hits = (data.results ?? [])
    .filter((p) => legacyResultMatchesTypes(p.types, allowedTypes))
    .map((p) => {
      const lat = p.geometry?.location?.lat;
      const lng = p.geometry?.location?.lng;
      return {
        placeId: p.place_id ?? "",
        name: p.name ?? "",
        address: p.vicinity ?? "",
        lat: typeof lat === "number" ? lat : null,
        lng: typeof lng === "number" ? lng : null,
        rating: typeof p.rating === "number" ? p.rating : null,
        primaryType: primaryTypeFromLegacy(p.types, allowedTypes),
        businessStatus: typeof p.business_status === "string"
          ? p.business_status
          : null,
        reviewCount: typeof p.user_ratings_total === "number"
          ? p.user_ratings_total
          : null,
      };
    })
    .filter((p) => p.placeId && p.name);
  return { ok: true, hits, nextPageToken: data.next_page_token };
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
  legacyPageTokenDelayMs = LEGACY_PAGE_TOKEN_DELAY_MS;
}

/** Tests only — skip the Legacy pagetoken settle delay. */
export function __setLegacyPageTokenDelayForTests(ms: number): void {
  legacyPageTokenDelayMs = ms;
}

/** Warm 15s cell hit, or null. List-places uses this so a cache hit does not
 *  consume the shared IP quota — only a miss meters, then fan-out. Types must
 *  match the search that filled the cell. */
export function peekCachedNearbyPlaces(
  center: { lat: number; lng: number },
  types?: readonly string[],
  pull?: number,
  rightNow = false,
): NearbyHit[] | null {
  const hit = nearbyCache.get(
    nearbyCellKey(
      center,
      resolveNearbyTypes(types),
      pull ?? GOOGLE_NEARBY_MAX,
      rightNow,
    ),
  );
  if (hit && Date.now() - hit.at < nearbyCacheMs(rightNow)) return hit.hits;
  return null;
}

function nearbyCacheMs(rightNow: boolean): number {
  return rightNow ? RIGHT_NOW_CACHE_MS : NEARBY_CACHE_MS;
}

export type SearchNearbyOpts = {
  /**
   * Max places to pull from Google: 20, 40 or 60 (`discovery_config.map.googlePull`).
   * Google bills Nearby in pages of 20; 40 and 60 are 2 and 3 billed requests
   * over the same query (Legacy next_page_token). Not a loop until N match, and
   * not disjoint type slices. Omit = 20 = one New POST.
   */
  pull?: number;
  /** Nearby primary types. Omit = the five F&B batteries. Empty = no
   *  Google call. Super-driven search may send GOOGLE_SEARCH_TYPES
   *  (spa, museum, park, …) beyond the five. */
  types?: readonly string[];
  /**
   * Called once per BILLED CALL, not once per pull (MESITA-1700). A 40 or 60
   * pull fires 2 or 3 Nearby requests, and the ledger behind this hook counts
   * what Google charges for — one row per request — so 45/60s means 45 calls.
   * Charging once per pull let one authorised row buy three billed requests
   * and silently tripled the ceiling on a `verify_jwt = false` endpoint.
   *
   * Never called on a warm cell, an in-flight join, or an isolate-budget
   * skip. Return false to skip Google (quota deny); a denial partway through
   * a pull truncates it and keeps what the earlier slices already returned.
   */
  beforeFanout?: () => Promise<boolean>;
  /**
   * Feed › Right Now (MESITA-2295): one New POST (pull 20 only) whose mask
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
  pull: number = GOOGLE_NEARBY_MAX,
  rightNow = false,
): string {
  return `${center.lat.toFixed(2)},${center.lng.toFixed(2)}:${
    nearbyTypesKey(types)
  }:p${pull}${rightNow ? ":now" : ""}`;
}

/** Billed Nearby pages one pull buys. 20 → 1, 40 → 2, 60 → 3; never more than 3. */
export function nearbyCallCount(pull: number | undefined): number {
  const n = Math.ceil((Number(pull) || GOOGLE_NEARBY_MAX) / GOOGLE_NEARBY_MAX);
  return Math.min(3, Math.max(1, n));
}

const SUPER_SEARCH_TYPE_SET = new Set<string>(
  Object.values(GOOGLE_SEARCH_TYPES).flat(),
);

function resolveNearbyTypes(types?: readonly string[]): readonly string[] {
  if (!types) return NEARBY_TYPE_KEYS;
  return types.filter((t) => SUPER_SEARCH_TYPE_SET.has(t));
}

/** Closest Google places around `center`. Pull 20 = one Nearby Search (New)
 *  POST with every enabled primary type, maxResultCount 20, DISTANCE rank.
 *  Pull 40/60 = Legacy pagination on the same location/radius query — 20 per
 *  billed page, filtered to the enabled battery, distance-sorted. Same ~1 km
 *  cell reuses a successful 15s result. HTTP / parse failures are returned
 *  (Mesita still shows) but never cached. Concurrent same-cell pans share one
 *  in-flight call. Each isolate also caps cache-miss calls (20 / 60s). Shared
 *  IP quota is `beforeFanout` (nearby-google-quota.ts), charged once per BILLED
 *  REQUEST. A pull that does not complete every page still RETURNS what it got,
 *  but is never cached. */
export async function searchNearbyPlaces(
  apiKey: string,
  center: { lat: number; lng: number },
  opts: SearchNearbyOpts = {},
): Promise<NearbyHit[]> {
  const radius = GOOGLE_NEARBY_RADIUS_M;
  const beforeFanout = opts.beforeFanout;
  const types = resolveNearbyTypes(opts.types);
  if (types.length === 0) return [];
  const rightNow = opts.rightNow === true;
  // Right Now's extra fields ride the New POST only, so it is one page.
  const pull = rightNow ? GOOGLE_NEARBY_MAX : opts.pull ?? GOOGLE_NEARBY_MAX;
  const pages = nearbyCallCount(pull);
  const key = nearbyCellKey(center, types, pull, rightNow);
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
    let complete = true;
    const seen = new Set<string>();
    let hits: NearbyHit[] = [];
    let pageToken: string | undefined;

    for (let page = 0; page < pages && hits.length < pull; page++) {
      pruneGoogleFanout(Date.now());
      if (googleFanoutAt.length >= GOOGLE_FANOUT_MAX) {
        console.warn("[nearby] isolate Google fan-out budget exhausted");
        complete = false;
        break;
      }
      if (beforeFanout && !(await beforeFanout())) {
        complete = false;
        break;
      }
      googleFanoutAt.push(Date.now());

      if (pages <= 1) {
        const batch = await searchNearbyOnce(
          apiKey,
          center,
          radius,
          [...types],
          rightNow,
        );
        if (!batch.ok) {
          complete = false;
          break;
        }
        for (const hit of batch.hits) {
          if (seen.has(hit.placeId)) continue;
          seen.add(hit.placeId);
          hits.push(hit);
        }
        break;
      }

      if (page > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, legacyPageTokenDelayMs)
        );
      }
      const batch = await searchNearbyLegacyPage(
        apiKey,
        center,
        radius,
        types,
        pageToken,
      );
      if (!batch.ok) {
        complete = false;
        break;
      }
      for (const hit of batch.hits) {
        if (seen.has(hit.placeId)) continue;
        seen.add(hit.placeId);
        hits.push(hit);
        if (hits.length >= pull) break;
      }
      pageToken = batch.nextPageToken;
      if (!pageToken) break;
    }

    if (pages > 1) {
      hits.sort(
        (a, b) =>
          haversineKm(center.lat, center.lng, a.lat, a.lng) -
          haversineKm(center.lat, center.lng, b.lat, b.lng),
      );
      hits = hits.slice(0, pull);
    }

    if (complete) nearbyCache.set(key, { at: Date.now(), hits });
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

export const PLACES_SCOPE_DEFAULT: PlacesScope = "mesita";

const PLACES_SCOPES: readonly PlacesScope[] = ["enriched", "mesita", "google"];

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
 * Which Mesita rows a scope admits. The rings NEST, so a wider ring never
 * shows FEWER Mesita places: `google` keeps exactly the `mesita` ring's rows
 * and only adds Google ones alongside them, and `enriched` is the `mesita`
 * ring cut to the rows an Enrich run completed.
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
): Array<NearbyMerged<T>> {
  const inCircle = (lat: number | null, lng: number | null) =>
    haversineKm(center.lat, center.lng, lat, lng) <= NEARBY_RADIUS_KM;
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
    const merged: Array<NearbyMerged<T>> = hits.map((hit) => {
      const row = byGid.get(hit.placeId);
      if (row) return { kind: "listed" as const, row };
      return { kind: "google" as const, hit };
    });
    // pinCount (`mesitaCount`) caps the painted union. googlePull only limits
    // what we buy from Google; Mesita listed rows backfill the rest.
    const usedIds = new Set(
      merged.flatMap((item) => item.kind === "listed" ? [item.row.id] : []),
    );
    const remaining = lanes.mesitaCount - merged.length;
    if (remaining > 0) {
      for (
        const row of takeClosest(
          inMesita.filter((r) => !usedIds.has(r.id)),
          center,
          remaining,
        )
      ) {
        merged.push({ kind: "listed" as const, row });
      }
    }
    return merged;
  }

  return takeClosest(inMesita, center, lanes.mesitaCount).map((row) => ({
    kind: "listed" as const,
    row,
  }));
}
