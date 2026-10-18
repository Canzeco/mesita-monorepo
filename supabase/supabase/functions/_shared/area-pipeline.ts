// THE AREA PIPELINE (MESITA-2302, reshaped by MESITA-2327). Places relative
// to a geographic anchor — the device, a picked city, a dropped pin or the
// map's centre, not necessarily where the guest stands. Map and the Feed are
// VIEWS of Area (pins, rows); they share this one retrieval and ranking.
//
//   Sources  Google Nearby Search · Mesita Places Search
//   Gates    Family (every scope) · Selected (the Mesita Selected scope)
//   Signals  Proximity · Popularity
//   Score    familyGate × selectedGate × proximity × popularity
//            (area-score.ts; exponents 1, no weights)
//
// Two entry points, one per guest scope:
//   selectGooglePlaces   Google Places — ONE Nearby Search (New) call inside
//                        the operator's `map.radiusKm`; a hit Mesita owns
//                        goes out as that Mesita row, the rest as Google-only
//                        stubs. No Mesita backfill, no fallback to the
//                        Selected set: a refused or empty call is empty.
//   selectMesitaSelected Mesita Selected — the Selected gate on, enriched,
//                        ready rows inside the radius.
//
// Every candidate must be inside the radius (`map.radiusKm`) to be a
// candidate at all; Proximity then ranks the ones inside. Closed places never
// appear (Discovery › General's active check). Fail closed on money: no key,
// no centre, no types, a quota refusal, a ledger, Google or owned-lookup
// error all return no Google places. Dedup is by google_place_id here, once.
// No photo field is ever asked for an ephemeral card, and nothing here
// writes a row.

import { CATALOG_FAMILY_SLUGS } from "./catalog-families.ts";
import { nearbyTypesForSupers } from "./google-type-super.ts";
import { catalogAdmitted } from "./catalog-rank.ts";
import { googleStub } from "./google-stub.ts";
import { applyBboxPredicate, type BboxQuery, haversineKm, nearbyBbox } from "./geo.ts";
import {
  applyGeneralGateQuery,
  clearsGeneralGate,
  type FilterableQuery,
} from "./discovery-general-gate.ts";
import { clearsMinReviews } from "./map-engine.ts";
import { familiesForPlace } from "./place-taxonomy.ts";
import { type AreaCandidate, type AreaContext, rankArea } from "./area-score.ts";
import {
  POPULARITY_REFERENCE_RATING_DEFAULT,
  POPULARITY_REFERENCE_REVIEWS_DEFAULT,
  PROXIMITY_HALF_DISTANCE_KM_DEFAULT,
} from "./pipeline-signals.ts";
import type { DiscoveryConfig, GeneralConfig, SignalParams } from "./discovery-config.ts";
import {
  type NearbyHit,
  peekCachedNearbyPlaces,
  searchNearbyPlaces,
} from "./nearby-places.ts";

/** Every guest family's Nearby types: the Feed's Google Places rail asks
 *  for all of them in its one call. */
export const FEED_GOOGLE_TYPES: readonly string[] = nearbyTypesForSupers(
  CATALOG_FAMILY_SLUGS,
);

type Center = { lat: number; lng: number };

/** Proximity's half distance and Popularity's reference, from the blob. */
export function areaSignalParams(params: SignalParams): Pick<
  AreaContext,
  "halfDistanceKm" | "popularityReference"
> {
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  return {
    halfDistanceKm: num(params.proximity?.halfDistanceKm, PROXIMITY_HALF_DISTANCE_KM_DEFAULT),
    popularityReference: {
      rating: num(params.popularity?.referenceRating, POPULARITY_REFERENCE_RATING_DEFAULT),
      reviews: num(params.popularity?.referenceReviews, POPULARITY_REFERENCE_REVIEWS_DEFAULT),
    },
  };
}

/** Area keeps only Discovery › General's active check: its reviews floor is
 *  the Name pipeline's; Area's own is `map.googleMinReviews`. */
function activeOnly(general: GeneralConfig): GeneralConfig {
  return { ...general, minReviews: 0 };
}

/** A Mesita row that may own a hit: active, ready, with its google id. */
export type OwnedRow = Record<string, unknown> & {
  id: string;
  google_place_id?: string | null;
  lat?: number | null;
  lng?: number | null;
};

const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** A Mesita row as an Area candidate. */
export function mesitaCandidate(row: Record<string, unknown>): AreaCandidate {
  return {
    id: String(row.id ?? ""),
    lat: numOrNull(row.lat),
    lng: numOrNull(row.lng),
    rating: numOrNull(row.google_stars_overall),
    reviewCount: numOrNull(row.google_review_count),
    familyKeys: familiesForPlace(row),
    selected: catalogAdmitted(row as { enriched_at?: string | null; content_state?: string | null }),
  };
}

export type GoogleSelectionDeps<T extends OwnedRow> = {
  /** GMP key, or null when the server has none (no Google call). */
  apiKey: string | null;
  /** The anchor: the camera centre or the guest; null = no Google call. */
  center: Center | null;
  /** The operator's one circle, `map.radiusKm`. */
  radiusKm: number;
  /** Nearby `includedPrimaryTypes`: the Family gate pushed down. Empty = no
   *  Google call. */
  types: readonly string[];
  /** The Family gate's requested families; empty = every family. */
  families?: readonly string[];
  /** From `guestReviewFloor("google", raw)`; the operator's
   *  `map.googleMinReviews` also applies, the higher one cuts. */
  minReviews: number;
  /** At most this many places out. */
  limit: number;
  cfg: Pick<DiscoveryConfig, "general" | "map" | "params">;
  /** The per-IP ledger, once per billed call. False = no Google call. */
  consumeQuota: () => Promise<boolean>;
  /** Active, ready Mesita rows holding these google ids; null on error. */
  lookupOwned: (gids: string[]) => Promise<T[] | null>;
};

export type GoogleSelection = {
  places: Array<Record<string, unknown>>;
  /** Raw hits Google returned (or the warm cell held), before eligibility. */
  hits: number;
};

function roundedKm(
  center: Center,
  lat: number | null | undefined,
  lng: number | null | undefined,
): number | null {
  const km = haversineKm(center.lat, center.lng, lat ?? null, lng ?? null);
  return Number.isFinite(km) ? Math.round(km * 10) / 10 : null;
}

/** Eligibility after Google answers (never an API param, never a refill):
 *  inside the radius, active, and over the reviews floor. */
export function eligibleGoogleHits(
  hits: readonly NearbyHit[],
  center: Center,
  radiusKm: number,
  minReviews: number,
  cfg: { general: GeneralConfig },
): NearbyHit[] {
  const seen = new Set<string>();
  const general = activeOnly(cfg.general);
  return hits.filter((hit) => {
    if (seen.has(hit.placeId)) return false;
    seen.add(hit.placeId);
    if (haversineKm(center.lat, center.lng, hit.lat, hit.lng) > radiusKm) {
      return false;
    }
    if (!clearsGeneralGate(general, hit)) return false;
    return !(minReviews > 0) || clearsMinReviews(hit.reviewCount, minReviews);
  });
}

/** Google Places, ranked by the Area score, at most `limit`. */
export async function selectGooglePlaces<T extends OwnedRow>(
  deps: GoogleSelectionDeps<T>,
): Promise<GoogleSelection> {
  const { apiKey, center, radiusKm, types } = deps;
  if (!apiKey || !center || types.length === 0 || !(deps.limit > 0)) {
    return { places: [], hits: 0 };
  }

  // A warm cell spends nothing, not even a ledger row.
  const hits = peekCachedNearbyPlaces(center, types, radiusKm) ??
    await searchNearbyPlaces(apiKey, center, {
      types,
      radiusKm,
      beforeFanout: deps.consumeQuota,
    });

  const eligible = eligibleGoogleHits(
    hits,
    center,
    radiusKm,
    Math.max(deps.minReviews, deps.cfg.map.googleMinReviews ?? 0),
    deps.cfg,
  );
  if (eligible.length === 0) return { places: [], hits: hits.length };

  const owned = await deps.lookupOwned(eligible.map((hit) => hit.placeId));
  // Without the owned set a stub could shadow a Mesita place: fail closed.
  if (owned === null) return { places: [], hits: hits.length };
  const byGid = new Map<string, T>();
  for (const row of owned) {
    const gid = typeof row.google_place_id === "string"
      ? row.google_place_id.trim()
      : "";
    if (gid && !byGid.has(gid)) byGid.set(gid, row);
  }

  const items = eligible.map((hit) => {
    const row = byGid.get(hit.placeId);
    const km = roundedKm(center, hit.lat, hit.lng);
    if (row) {
      const { google_place_id: _gid, ...rest } = row;
      return {
        candidate: mesitaCandidate(row),
        place: {
          ...rest,
          distance_km: roundedKm(center, row.lat, row.lng) ?? km,
        } as Record<string, unknown>,
      };
    }
    const stub = googleStub(hit, km);
    return {
      candidate: {
        id: String(stub.id),
        lat: hit.lat,
        lng: hit.lng,
        rating: hit.rating,
        reviewCount: hit.reviewCount,
        familyKeys: (stub.family_keys as string[] | undefined) ?? [],
        selected: false,
      } satisfies AreaCandidate,
      place: stub,
    };
  });

  const ranked = rankArea(items, (item) => item.candidate, {
    anchor: center,
    families: deps.families ?? [],
    selectedOnly: false,
    ...areaSignalParams(deps.cfg.params),
  });
  return {
    places: ranked.slice(0, deps.limit).map((r) => r.item.place),
    hits: hits.length,
  };
}

export type SelectedOpts = {
  /** The anchor, or null (no radius, Proximity abstains). */
  center: Center | null;
  radiusKm: number;
  /** The Family gate's requested families; empty or absent = every family. */
  families?: readonly string[];
  params: SignalParams;
  limit?: number;
};

/** Mesita Selected, ranked by the Area score with the Selected gate on. */
export function selectMesitaSelected<T extends Record<string, unknown>>(
  rows: readonly T[],
  opts: SelectedOpts,
): Array<T & { distance_km: number | null }> {
  const { center } = opts;
  const inside = rows.filter((row) => {
    if (!center) return true;
    const km = roundedKm(center, numOrNull(row.lat), numOrNull(row.lng));
    return km !== null && km <= opts.radiusKm;
  });
  const ranked = rankArea(inside, mesitaCandidate, {
    anchor: center,
    families: opts.families ?? [],
    selectedOnly: true,
    ...areaSignalParams(opts.params),
  });
  const out = ranked.map(({ item }) => ({
    ...item,
    distance_km: center ? roundedKm(center, numOrNull(item.lat), numOrNull(item.lng)) : null,
  }));
  return opts.limit === undefined ? out : out.slice(0, opts.limit);
}

/** The builder `selectedPoolQuery` needs (supabase-js satisfies it). */
export type SelectedPoolQuery<Q> =
  & FilterableQuery<Q>
  & BboxQuery<Q>
  & {
    not: (col: string, op: string, val: unknown) => Q;
    overlaps: (col: string, val: string[]) => Q;
  };

/** A supabase-js select, seen structurally: what the two EFs hand
 *  `selectedPoolQuery` (the full generic type is too deep to infer). */
export interface PoolBuilder extends SelectedPoolQuery<PoolBuilder> {
  limit: (n: number) => PromiseLike<{
    data: unknown[] | null;
    error: { message: string } | null;
  }>;
}

/**
 * The Mesita Selected pool in SQL, the same on the Map and the Feed, with
 * the gates PUSHED DOWN so a dense area does not fill the row cap with rows
 * the ranking would drop: Selected (an Enrich run completed, ready), active,
 * the requested families, and the radius box around the anchor.
 */
export function selectedPoolQuery<Q extends SelectedPoolQuery<Q>>(
  query: Q,
  cfg: Pick<DiscoveryConfig, "general">,
  opts: { center: Center | null; radiusKm: number; families?: readonly string[] },
): Q {
  let q: Q = query.not("enriched_at", "is", null).eq("content_state", "ready");
  q = applyGeneralGateQuery(q, activeOnly(cfg.general));
  if (opts.families && opts.families.length > 0) {
    q = q.overlaps("family_keys", [...opts.families]);
  }
  if (opts.center) {
    q = applyBboxPredicate(
      q,
      nearbyBbox(opts.center.lat, opts.center.lng, opts.radiusKm),
    );
  }
  return q;
}
