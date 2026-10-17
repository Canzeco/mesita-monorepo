// Feed › Right Now from Google (MESITA-2295): every Google place open right
// now near the guest, 5 nearest. It is Search's Google path, not a second
// one: the same Nearby call (`searchNearbyPlaces`, its cell cache, in-flight
// join and isolate budget), the same per-IP ledger (`beforeFanout`), the same
// Mesita-wins dedupe (`claimOwnedHits` + `mergeNearbyCatalog`) and the same
// Google-only card (`googleStub`). The differences are small:
//   - the mask adds `currentOpeningHours.openNow` + `photos`, in its own
//     cell cached RIGHT_NOW_CACHE_MS (Search's mask and 15 s cell stay);
//   - the 15 guest families' types, pull 20, one call;
//   - only `openNow === true` and `OPERATIONAL`, nearest first, 5;
//   - one photo per Google-only card, resolved here, the key never sent.
// Fail closed on money: no key, no location, a quota refusal, a ledger or
// Google error all return null, and the caller keeps Right Now on Mesita
// Created Places. An area with nothing open returns null too.

import { CATALOG_FAMILY_SLUGS } from "./catalog-families.ts";
import { nearbyTypesForSupers } from "./google-type-super.ts";
import { CATALOG_RAIL_CAP } from "./catalog-rank.ts";
import { googleStub } from "./google-stub.ts";
import { haversineKm } from "./geo.ts";
import {
  claimOwnedHits,
  GOOGLE_NEARBY_MAX,
  mergeNearbyCatalog,
  type NearbyHit,
  peekCachedNearbyPlaces,
  resolveGoogleItem,
  RIGHT_NOW_CACHE_MS,
  searchNearbyPlaces,
} from "./nearby-places.ts";

/** Every guest family's Nearby types: Right Now asks Google for all of them. */
export const RIGHT_NOW_TYPES: readonly string[] = nearbyTypesForSupers(
  CATALOG_FAMILY_SLUGS,
);

/** A Mesita row that may own a hit: active, ready, with its google id. */
export type RightNowOwnedRow = Record<string, unknown> & {
  id: string;
  google_place_id?: string | null;
  enriched_at?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type RightNowDeps<T extends RightNowOwnedRow> = {
  /** GMP key, or null when the server has none (no Google call). */
  apiKey: string | null;
  /** The guest's location, or null (no Google call). */
  center: { lat: number; lng: number } | null;
  /** The per-IP ledger, once per billed call. False = no Google call. */
  consumeQuota: () => Promise<boolean>;
  /** Active, ready Mesita rows holding these google ids; null on error. */
  lookupOwned: (gids: string[]) => Promise<T[] | null>;
};

const photoCache = new Map<string, { at: number; uri: string | null }>();

export function __resetRightNowPhotosForTests(): void {
  photoCache.clear();
}

/** One photo for one Google-only card, cached with the area. */
async function resolvePhoto(
  apiKey: string,
  hit: NearbyHit,
): Promise<string | null> {
  if (!hit.photoName) return null;
  const cached = photoCache.get(hit.placeId);
  if (cached && Date.now() - cached.at < RIGHT_NOW_CACHE_MS) return cached.uri;
  let uri: string | null = null;
  try {
    const r = await fetch(
      `https://places.googleapis.com/v1/${hit.photoName}/media?maxHeightPx=800&skipHttpRedirect=true`,
      { headers: { "X-Goog-Api-Key": apiKey } },
    );
    if (r.ok) {
      const d = (await r.json()) as { photoUri?: string };
      uri = typeof d.photoUri === "string" && d.photoUri.startsWith("https://")
        ? d.photoUri
        : null;
    } else {
      await r.body?.cancel();
    }
  } catch (err) {
    console.error("[right-now] photo failed", (err as Error).message);
  }
  photoCache.set(hit.placeId, { at: Date.now(), uri });
  return uri;
}

function roundedKm(
  center: { lat: number; lng: number },
  lat: number | null | undefined,
  lng: number | null | undefined,
): number | null {
  const km = haversineKm(center.lat, center.lng, lat ?? null, lng ?? null);
  return Number.isFinite(km) ? Math.round(km * 10) / 10 : null;
}

/**
 * The Google Right Now rail's places, nearest first, at most
 * CATALOG_RAIL_CAP. A hit an active Mesita row owns goes out as that row
 * (Reserve works); the rest are Google-only stubs with one photo. Null
 * means "keep the Mesita Right Now".
 */
export async function rightNowGooglePlaces<T extends RightNowOwnedRow>(
  deps: RightNowDeps<T>,
): Promise<Array<Record<string, unknown>> | null> {
  const { apiKey, center } = deps;
  if (!apiKey || !center) return null;

  // A warm cell spends nothing, not even a ledger row.
  const hits = peekCachedNearbyPlaces(
    center,
    RIGHT_NOW_TYPES,
    GOOGLE_NEARBY_MAX,
    true,
  ) ?? await searchNearbyPlaces(apiKey, center, {
    types: RIGHT_NOW_TYPES,
    rightNow: true,
    beforeFanout: deps.consumeQuota,
  });

  const open = hits.filter((hit) =>
    hit.openNow === true && hit.businessStatus === "OPERATIONAL"
  );
  if (open.length === 0) return null;

  const owned = await deps.lookupOwned([
    ...new Set(open.map((hit) => hit.placeId)),
  ]);
  if (owned === null) return null;

  // Every owned row is the ring here: nothing on the Feed cuts a Mesita row
  // that Google says is open, so each owned hit pairs with its row.
  const claim = claimOwnedHits(open, owned, owned);
  const merged = mergeNearbyCatalog(owned, claim.hits, center, {
    mesitaCount: CATALOG_RAIL_CAP,
    googleCount: CATALOG_RAIL_CAP,
  }).slice(0, CATALOG_RAIL_CAP);

  const out = await Promise.all(
    merged.map(async (item): Promise<Record<string, unknown> | null> => {
      if (item.kind === "listed") {
        const { google_place_id: _gid, ...row } = item.row;
        return {
          ...row,
          distance_km: roundedKm(center, item.row.lat, item.row.lng),
        };
      }
      const resolved = resolveGoogleItem(item.hit, claim);
      if (resolved.kind !== "stub") return null;
      const stub = googleStub(
        item.hit,
        roundedKm(center, item.hit.lat, item.hit.lng),
      );
      const photo = await resolvePhoto(apiKey, item.hit);
      return { ...stub, photos: photo ? [photo] : [] };
    }),
  );
  const places = out.filter((p): p is Record<string, unknown> => p !== null);
  return places.length > 0 ? places : null;
}
