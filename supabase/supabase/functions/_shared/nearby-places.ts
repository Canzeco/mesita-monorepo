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
// ONE POST per cache-miss cell (center · types · radius · rank): maxResultCount
// 20, the family-derived primary types, the ONE field mask. Nearby Search
// (New) has no pages, so the Area pipeline's 40 and 60 Google candidates are
// two or three DIFFERENT calls (rank preference and circle differ, so each
// is its own cell), never a second page (MESITA-2379). Mesita wins its gid
// in the Area pipeline (`selectAreaPool`, area-pipeline.ts).

import {
  classifyGoogleError,
  GOOGLE_PLACES_NEARBY_URL,
  stripPlacesPrefix,
} from "./google-places.ts";
import { NEARBY_RADIUS_KM } from "./geo.ts";
import { EVERY_FAMILY_TYPES, GOOGLE_SEARCH_TYPES } from "./google-type-super.ts";

/** Nearby Search (New) caps one POST at maxResultCount 20 with no page
 *  token (MESITA-2298); more candidates take more, different calls. */
export const GOOGLE_NEARBY_MAX = 20;
/** The operator's circle, in metres, clamped to what Nearby accepts
 *  (50 m .. 50 km). `map.radiusKm` is 1..50; a bad value reads as 50 km. */
export function nearbyRadiusMetres(radiusKm?: number): number {
  const km = typeof radiusKm === "number" && Number.isFinite(radiusKm) &&
      radiusKm > 0
    ? radiusKm
    : NEARBY_RADIUS_KM;
  return Math.min(50_000, Math.max(50, Math.round(km * 1000)));
}
export const NEARBY_CACHE_MS = 15_000;
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
  "places.types",
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
  /** Google's `types[]`: the place's other types, where its secondary
   *  families come from (MESITA-2438). Same Pro SKU as `primaryType`. */
  types?: string[];
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
  types?: string[];
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
    types: Array.isArray(p.types) ? p.types.filter((t) => typeof t === "string") : [],
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

/** Nearby's two orders: nearest first, or Google's prominence. */
export type NearbyRank = "DISTANCE" | "POPULARITY";

type NearbyOnce =
  | { ok: true; hits: NearbyHit[] }
  | { ok: false };

/** One retry on a Google 5xx or a network throw (MESITA-2361): a single
 *  transient Google 500 hid the whole Google Places rail. The retry rides
 *  the one metered attempt for the cell; a 4xx is the request's fault and
 *  never retried. */
export const NEARBY_RETRY_DELAY_MS = 250;

async function searchNearbyOnce(
  apiKey: string,
  center: { lat: number; lng: number },
  radiusM: number,
  includedPrimaryTypes: string[],
  excludedPrimaryTypes: string[] = [],
  rankPreference: NearbyRank = "DISTANCE",
): Promise<NearbyOnce> {
  const post = () =>
    fetch(GOOGLE_PLACES_NEARBY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": NEARBY_FIELD_MASK,
      },
      body: JSON.stringify({
        maxResultCount: GOOGLE_NEARBY_MAX,
        rankPreference,
        includedPrimaryTypes,
        ...(excludedPrimaryTypes.length > 0 ? { excludedPrimaryTypes } : null),
        locationRestriction: {
          circle: {
            center: { latitude: center.lat, longitude: center.lng },
            radius: Math.min(50_000, Math.max(50, radiusM)),
          },
        },
      }),
    });
  let r: Response;
  try {
    r = await post();
  } catch (err) {
    console.error("[nearby] Google searchNearby threw; retrying once", String(err));
    await new Promise((res) => setTimeout(res, NEARBY_RETRY_DELAY_MS));
    r = await post();
  }
  if (r.status >= 500) {
    const text = await r.text();
    console.error(
      "[nearby] Google searchNearby 5xx; retrying once",
      r.status,
      text.slice(0, 300),
    );
    await new Promise((res) => setTimeout(res, NEARBY_RETRY_DELAY_MS));
    r = await post();
  }
  if (!r.ok) {
    const text = await r.text();
    const code = classifyGoogleError(r.status, text);
    console.error("[nearby] Google searchNearby failed", code, r.status, text.slice(0, 300));
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
export const GOOGLE_FANOUT_MAX = 60;
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

/** The cell's shape beyond centre · types · radius: Nearby's order, and
 *  whether the centre keys at 5 decimals (the Area fan-out's circles, whose
 *  centres can sit inside one 2-decimal cell, MESITA-2379) or at 2. */
export type NearbyCellShape = { rankPreference?: NearbyRank; preciseCell?: boolean };

/** Warm 15s cell hit, or null. Callers peek first so a cache hit does not
 *  consume the shared IP quota — only a miss meters, then fan-out. Types,
 *  radius, rank and precision must match the search that filled the cell. */
export function peekCachedNearbyPlaces(
  center: { lat: number; lng: number },
  types?: readonly string[],
  radiusKm?: number,
  excludedTypes: readonly string[] = [],
  shape: NearbyCellShape = {},
): NearbyHit[] | null {
  const hit = nearbyCache.get(
    nearbyCellKey(
      center,
      resolveNearbyTypes(types),
      nearbyRadiusMetres(radiusKm),
      excludedTypes,
      shape,
    ),
  );
  if (hit && Date.now() - hit.at < NEARBY_CACHE_MS) return hit.hits;
  return null;
}

export type SearchNearbyOpts = {
  /** Nearby primary types (`includedPrimaryTypes`): the guest's families'
   *  batteries, or every guest family's when omitted (EVERY_FAMILY_TYPES).
   *  Empty = no Google call. */
  types?: readonly string[];
  /** The operator's circle (`map.radiusKm`, MESITA-2298 §3). Omit = 50 km.
   *  Part of the cache cell: two radii are two answers. */
  radiusKm?: number;
  /** Nearby `excludedPrimaryTypes` (MESITA-2338): the precise subtypes of
   *  an included general type that belong to no requested family, so the
   *  Family gate's pushdown is exact (Dinner sends `restaurant` and
   *  excludes `mexican_restaurant`). Part of the cache cell. */
  excludedTypes?: readonly string[];
  /**
   * Called once, right before the ONE billed Nearby call (MESITA-1700): the
   * ledger behind this hook counts what Google charges for. `false` skips
   * Google for this cell; nothing is cached.
   */
  beforeFanout?: () => Promise<boolean>;
} & NearbyCellShape;

function nearbyTypesKey(types: readonly string[]): string {
  return [...types].sort().join(",") || "none";
}

function nearbyCellKey(
  center: { lat: number; lng: number },
  types: readonly string[] = EVERY_FAMILY_TYPES,
  radiusM: number = nearbyRadiusMetres(),
  excludedTypes: readonly string[] = [],
  shape: NearbyCellShape = {},
): string {
  const dp = shape.preciseCell ? 5 : 2;
  const rank = shape.rankPreference ?? "DISTANCE";
  const base = `${center.lat.toFixed(dp)},${center.lng.toFixed(dp)}:${
    nearbyTypesKey(types)
  }:r${radiusM}:${rank}`;
  return excludedTypes.length > 0 ? `${base}:x${nearbyTypesKey(excludedTypes)}` : base;
}

const SUPER_SEARCH_TYPE_SET = new Set<string>(
  Object.values(GOOGLE_SEARCH_TYPES).flat(),
);

function resolveNearbyTypes(types?: readonly string[]): readonly string[] {
  if (!types) return EVERY_FAMILY_TYPES;
  return types.filter((t) => SUPER_SEARCH_TYPE_SET.has(t));
}

/** What one Nearby request did: billed and answered, answered from a warm
 *  cell, refused by the ledger or the isolate cap, or failed at Google. */
export type NearbyOutcome = "billed" | "cached" | "refused" | "failed" | "none";

/** The Google places around `center`: ONE Nearby Search (New) POST with the
 *  primary types, maxResultCount 20, the asked rank (DISTANCE unless
 *  POPULARITY), inside the circle (MESITA-2298). Never a second page. The
 *  same cell reuses a successful 15s result. HTTP / parse failures are
 *  returned (Mesita still shows) but never cached. Concurrent same-cell calls
 *  share one in-flight request. Each isolate also caps cache-miss calls
 *  (60 / 60s). Shared IP quota is `beforeFanout` (nearby-google-quota.ts),
 *  charged once per billed call. */
export async function searchNearbyPlaces(
  apiKey: string,
  center: { lat: number; lng: number },
  opts: SearchNearbyOpts = {},
): Promise<NearbyHit[]> {
  return (await searchNearbyPlacesOutcome(apiKey, center, opts)).hits;
}

/** `searchNearbyPlaces` with what happened, for the Area pipeline's log. */
export async function searchNearbyPlacesOutcome(
  apiKey: string,
  center: { lat: number; lng: number },
  opts: SearchNearbyOpts = {},
): Promise<{ hits: NearbyHit[]; outcome: NearbyOutcome }> {
  const radius = nearbyRadiusMetres(opts.radiusKm);
  const beforeFanout = opts.beforeFanout;
  const types = resolveNearbyTypes(opts.types);
  if (types.length === 0) return { hits: [], outcome: "none" };
  const excluded = (opts.excludedTypes ?? []).filter((t) => !types.includes(t));
  const rank = opts.rankPreference ?? "DISTANCE";
  const key = nearbyCellKey(center, types, radius, excluded, {
    rankPreference: rank,
    preciseCell: opts.preciseCell,
  });
  const hit = nearbyCache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < NEARBY_CACHE_MS) return { hits: hit.hits, outcome: "cached" };
  const pending = nearbyInflight.get(key);
  if (pending) return { hits: await pending, outcome: "cached" };

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
      return { hits: [], outcome: "refused" };
    }
    if (beforeFanout && !(await beforeFanout())) {
      resolveRun([]);
      return { hits: [], outcome: "refused" };
    }
    googleFanoutAt.push(Date.now());

    const batch = await searchNearbyOnce(apiKey, center, radius, [...types], excluded, rank);
    if (!batch.ok) {
      resolveRun([]);
      return { hits: [], outcome: "failed" };
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
    return { hits, outcome: "billed" };
  } catch (err) {
    resolveRun([]);
    throw err;
  } finally {
    nearbyInflight.delete(key);
  }
}

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
