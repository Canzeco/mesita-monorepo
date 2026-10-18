// Google Nearby + the guest's scope words (MESITA-2298, MESITA-2302).
// TWO GUEST SCOPES over the three internal sets
// (Google Places ⊃ Mesita Places ⊃ Mesita Enriched Places):
//   google    Google Places — what ONE Nearby Search (New) call returned
//             inside the operator's radius. A hit Mesita owns goes out as
//             that Mesita row (ready, enriched or not); the rest are stubs.
//             No Mesita backfill: a place Google did not return is absent.
//   selected  Mesita Selected — the enriched, ready Mesita rows. No Google
//             Nearby, no review floor.
// `PlacesScope` has exactly those two words; the retired `enriched`,
// `mesita` and `partners` parse to `selected`, never to a paid call.
// ONE POST per cache-miss cell (center · types · radius): maxResultCount
// 20, DISTANCE, the family-derived primary types, the ONE field mask;
// never a second page, never a wider circle. Mesita wins its gid
// (`claimOwnedHits`, `mergeNearbyCatalog`, `resolveGoogleItem`).

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
/** The largest `map.pinCount` stop; the merge's default Mesita cap. */
export const CATALOG_NEARBY_HARD_MAX = 60;
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
/** THE ONE field mask, Search and Feed alike: everything a Google-only card
 *  and its opening profile show (MESITA-2313), nothing else. `rating` and
 *  `userRatingCount` already bill the Enterprise SKU, so the other
 *  Enterprise fields (price, open now, phone, website) and the Pro ones
 *  (readable type, short address, Maps link) add no spend. Never a photo
 *  field: an ephemeral Google card draws its family emoji (MESITA-2298 §6),
 *  and never an Atmosphere field (reviews, summaries), a dearer SKU. */
export const NEARBY_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.priceLevel",
  "places.currentOpeningHours.openNow",
  "places.googleMapsUri",
  "places.internationalPhoneNumber",
  "places.websiteUri",
].join(",");

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
  /** Google's `currentOpeningHours.openNow`; null when Google did not say. */
  openNow: boolean | null;
  /** Google's readable type (`primaryTypeDisplayName.text`), e.g. "Sports bar". */
  typeLabel?: string | null;
  /** Google's `priceLevel` enum (`PRICE_LEVEL_MODERATE`), raw. */
  priceLevel?: string | null;
  /** `shortFormattedAddress`: street and area, without city and country. */
  shortAddress?: string | null;
  mapsUri?: string | null;
  phone?: string | null;
  website?: string | null;
};

/** One place as the listing mask returns it, Nearby and Text Search alike. */
export type GooglePlaceListing = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  priceLevel?: string;
  shortFormattedAddress?: string;
  currentOpeningHours?: { openNow?: boolean };
  googleMapsUri?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
};

/** THE parser for the listing mask (MESITA-2313, MESITA-2325): Nearby and
 *  Text Search both hand their places here, so a Google-only card carries
 *  the same facts whichever search found it. */
export function nearbyHitFromPlace(p: GooglePlaceListing): NearbyHit {
  const lat = p.location?.latitude;
  const lng = p.location?.longitude;
  return {
    placeId: stripPlacesPrefix(p.id ?? ""),
    name: p.displayName?.text ?? "",
    address: p.formattedAddress ?? "",
    lat: typeof lat === "number" ? lat : null,
    lng: typeof lng === "number" ? lng : null,
    rating: typeof p.rating === "number" ? p.rating : null,
    primaryType: p.primaryType ?? null,
    businessStatus: typeof p.businessStatus === "string" ? p.businessStatus : null,
    reviewCount: typeof p.userRatingCount === "number" ? p.userRatingCount : null,
    openNow: typeof p.currentOpeningHours?.openNow === "boolean"
      ? p.currentOpeningHours.openNow
      : null,
    typeLabel: p.primaryTypeDisplayName?.text?.trim() || null,
    priceLevel: p.priceLevel ?? null,
    shortAddress: p.shortFormattedAddress?.trim() || null,
    mapsUri: p.googleMapsUri ?? null,
    phone: p.internationalPhoneNumber?.trim() || null,
    website: p.websiteUri ?? null,
  };
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
      "X-Goog-FieldMask": NEARBY_FIELD_MASK,
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
  const data = (await r.json()) as { places?: GooglePlaceListing[] };
  const hits = (data.places ?? [])
    .map(nearbyHitFromPlace)
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

/** Warm 15s cell hit, or null. Callers peek first so a cache hit does not
 *  consume the shared IP quota — only a miss meters, then fan-out. Types and
 *  radius must match the search that filled the cell. */
export function peekCachedNearbyPlaces(
  center: { lat: number; lng: number },
  types?: readonly string[],
  radiusKm?: number,
): NearbyHit[] | null {
  const hit = nearbyCache.get(
    nearbyCellKey(
      center,
      resolveNearbyTypes(types),
      nearbyRadiusMetres(radiusKm),
    ),
  );
  if (hit && Date.now() - hit.at < NEARBY_CACHE_MS) return hit.hits;
  return null;
}

export type SearchNearbyOpts = {
  /** Nearby primary types (`includedPrimaryTypes`): the guest's families'
   *  batteries, or every guest family's when omitted (NEARBY_TYPE_KEYS).
   *  Empty = no Google call. */
  types?: readonly string[];
  /** The operator's circle (`map.radiusKm`, MESITA-2298 §3). Omit = 50 km.
   *  Part of the cache cell: two radii are two answers. */
  radiusKm?: number;
  /**
   * Called once, right before the ONE billed Nearby call (MESITA-1700): the
   * ledger behind this hook counts what Google charges for. `false` skips
   * Google for this cell; nothing is cached.
   */
  beforeFanout?: () => Promise<boolean>;
};

function nearbyTypesKey(types: readonly string[]): string {
  return [...types].sort().join(",") || "none";
}

function nearbyCellKey(
  center: { lat: number; lng: number },
  types: readonly string[] = NEARBY_TYPE_KEYS,
  radiusM: number = nearbyRadiusMetres(),
): string {
  return `${center.lat.toFixed(2)},${center.lng.toFixed(2)}:${
    nearbyTypesKey(types)
  }:r${radiusM}`;
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
  const key = nearbyCellKey(center, types, radius);
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
    googleFanoutAt.push(Date.now());

    const batch = await searchNearbyOnce(apiKey, center, radius, [...types]);
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
 * THE GUEST'S TWO WORDS (MESITA-2298) over the three internal sets
 * (Google Places ⊃ Mesita Places ⊃ Mesita Enriched Places):
 *
 *   google    Google Places — Nearby's hits; a Mesita row that owns one
 *             (ready, enriched or not) goes out as itself.
 *   selected  Mesita Selected — the enriched, ready rows. Free: no Google.
 *
 * The wire carries the scope by NAME. A third word fails to compile here,
 * so no caller can ask for a set a guest cannot see. Absent, unknown and
 * the retired words (`enriched`, `mesita`, `partners`) all land on
 * `selected`, never on a paid call. Legacy ordinals keep their shipped
 * meanings (>= 2 = Google, lower = Mesita): Vercel and the Edge Functions
 * deploy on separate paths, so that skew window is real.
 */
export type PlacesScope = "google" | "selected";

export const PLACES_SCOPE_DEFAULT: PlacesScope = "selected";

const PLACES_SCOPES: readonly PlacesScope[] = ["google", "selected"];
const RETIRED_SCOPE_WORDS: readonly string[] = [
  "enriched",
  "mesita",
  "partners",
];

export function parsePlacesScope(value: unknown): PlacesScope {
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    if ((PLACES_SCOPES as readonly string[]).includes(key)) {
      return key as PlacesScope;
    }
    if (RETIRED_SCOPE_WORDS.includes(key)) return "selected";
    // A legacy numeric arriving as a string reads the same as the number.
    const legacy = Number(key);
    if (Number.isFinite(legacy) && key.length > 0) {
      return legacy >= 2 ? "google" : "selected";
    }
    return PLACES_SCOPE_DEFAULT;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 2 ? "google" : "selected";
  }
  return PLACES_SCOPE_DEFAULT;
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
 * Which Mesita rows a scope admits. Google Places admits every ready Mesita
 * row that owns a hit (a Created profile draws gray, an enriched one red)
 * and SHOWS only the ones Google returned, as their owners
 * (`mergeNearbyCatalog`, MESITA-2310). Mesita Selected admits enriched
 * rows only: a subset of Google Places, never a lane beside it.
 */
export function admitsScopeRow(
  scope: PlacesScope,
  row: { content_state?: string | null; enriched_at?: string | null },
): boolean {
  if (!isMesitaListedRow(row)) return false;
  return scope === "selected" ? isEnrichedListedRow(row) : true;
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
 * A stub's explicit open runs consumer-web-create-place as get-or-create
 * (MESITA-2298 §5): an owned gid answers `created: false` and opens the row
 * Mesita holds. The map must agree before the tap — the row is a Mesita
 * place, with its photo, its vote and its colour — so a hit whose
 * google_place_id a listed Mesita row carries resolves one of three ways:
 *
 *   ring   the row is in the scope's Mesita rows (on Google Places that is
 *          every ready Mesita row, Created ones included — MESITA-2158):
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
  lanes: NearbyLaneCaps = {
    mesitaCount: CATALOG_NEARBY_HARD_MAX,
    googleCount: GOOGLE_NEARBY_MAX,
  },
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
