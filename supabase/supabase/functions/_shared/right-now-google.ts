// Feed › Right Now from Google (MESITA-2295): every Google place open right
// now near the guest, 5 nearest. It is Search's Google path, not a second
// one: the same Nearby call (`searchNearbyPlaces`, its cell cache, in-flight
// join and isolate budget), the same per-IP ledger (`beforeFanout`), the same
// Mesita-wins dedupe (`claimOwnedHits` + `mergeNearbyCatalog`) and the same
// Google-only card (`googleStub`). The differences are small:
//   - the mask adds `currentOpeningHours.openNow`, in its own cell cached
//     RIGHT_NOW_CACHE_MS (Search's mask and 15 s cell stay);
//   - the 15 guest families' types, pull 20, one call;
//   - only `openNow === true` and `OPERATIONAL`, nearest first, 5;
//   - no photo: a Google-only card draws its family emoji (MESITA-2298),
//     so no `/media` call is ever made for a card.
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
 * (Reserve works); the rest are Google-only stubs with no photo. Null
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

  const out = merged.map((item): Record<string, unknown> | null => {
    if (item.kind === "listed") {
      const { google_place_id: _gid, ...row } = item.row;
      return {
        ...row,
        distance_km: roundedKm(center, item.row.lat, item.row.lng),
      };
    }
    const resolved = resolveGoogleItem(item.hit, claim);
    if (resolved.kind !== "stub") return null;
    return googleStub(item.hit, roundedKm(center, item.hit.lat, item.hit.lng));
  });
  const places = out.filter((p): p is Record<string, unknown> => p !== null);
  return places.length > 0 ? places : null;
}
