// THE SHARED DISCOVERY ENGINE (MESITA-2302). Map and the Feed's rails 1–2
// are one selection and ranking system, two functions, one per guest scope:
//
//   selectGooglePlaces   Google Places — ONE Nearby Search (New) call inside
//                        the operator's `map.radiusKm`, eligibility after
//                        Google answers (General gate · Map floors · the
//                        guest Google Reviews floor), a hit Mesita owns goes
//                        out as that Mesita row, the rest as Google-only
//                        stubs, ranked on the Map column (popularity leads,
//                        open-now may boost through Timing), distance the
//                        tiebreak. No Mesita backfill, no fallback to the
//                        Selected set: a refused or empty call is empty.
//   selectMesitaSelected Mesita Selected — enriched, ready rows inside the
//                        radius, ranked on `catalog.ranking`. It has no
//                        review-floor or Google-hit parameter, so neither can
//                        reach the Selected path.
//
// Weights differ by SCOPE, never by view: the Map's Google scope and the
// Feed's Google Places rail rank alike, and the Map's Selected scope and the
// Feed's Mesita Selected and family rails rank alike.
//
// Fail closed on money: no key, no centre, no types, a quota refusal, a
// ledger, Google or owned-lookup error all return no Google places. Dedup is
// by google_place_id here, once. No photo field is ever asked for an
// ephemeral card (it draws its family emoji), and nothing here writes a row.

import { CATALOG_FAMILY_SLUGS } from "./catalog-families.ts";
import { nearbyTypesForSupers } from "./google-type-super.ts";
import { catalogAdmitted, catalogScore } from "./catalog-rank.ts";
import { googleStub } from "./google-stub.ts";
import { haversineKm } from "./geo.ts";
import { rankByBlend } from "./discovery-blend.ts";
import { toLineupPlace } from "./discovery-place.ts";
import {
  applyGeneralGateQuery,
  clearsGeneralGate,
} from "./discovery-general-gate.ts";
import {
  applyDiscoveryFilters,
  type DiscoveryFilterQuery,
} from "./discovery-filters.ts";
import { applyBboxPredicate, type BboxQuery, nearbyBbox } from "./geo.ts";
import {
  clearsMinReviews,
  googleHitClearsMapFloors,
  listedClearsMapPopularity,
  listedMapFilters,
} from "./map-engine.ts";
import {
  mapLineupIntent,
  mapLineupWeights,
  toMapLineupPlace,
} from "./nearby-lineup.ts";
import { familiesForPlace } from "./place-taxonomy.ts";
import type {
  CatalogRankKey,
  DiscoveryConfig,
  MapConfig,
  SignalParams,
} from "./discovery-config.ts";
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

/** A Mesita row that may own a hit: active, ready, with its google id. */
export type OwnedRow = Record<string, unknown> & {
  id: string;
  google_place_id?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type GoogleSelectionDeps<T extends OwnedRow> = {
  /** GMP key, or null when the server has none (no Google call). */
  apiKey: string | null;
  /** The camera centre or the guest, or null (no Google call). */
  center: Center | null;
  /** The operator's one circle, `map.radiusKm`. */
  radiusKm: number;
  /** Nearby `includedPrimaryTypes`. Empty = no Google call. */
  types: readonly string[];
  /** From `guestReviewFloor("google", raw)`: the only floor that may cut. */
  minReviews: number;
  /** At most this many places out. */
  limit: number;
  cfg: Pick<DiscoveryConfig, "general" | "map" | "params" | "weights" | "weightsByMode">;
  /** The per-IP ledger, once per billed call. False = no Google call. */
  consumeQuota: () => Promise<boolean>;
  /** Active, ready Mesita rows holding these google ids; null on error. */
  lookupOwned: (gids: string[]) => Promise<T[] | null>;
  now?: Date;
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

/** Eligibility, after Google answers and never as an API param or refill. */
export function eligibleGoogleHits(
  hits: readonly NearbyHit[],
  center: Center,
  radiusKm: number,
  minReviews: number,
  cfg: { general: DiscoveryConfig["general"]; map: MapConfig },
): NearbyHit[] {
  const seen = new Set<string>();
  return hits.filter((hit) => {
    if (seen.has(hit.placeId)) return false;
    seen.add(hit.placeId);
    if (haversineKm(center.lat, center.lng, hit.lat, hit.lng) > radiusKm) {
      return false;
    }
    if (!clearsGeneralGate(cfg.general, hit)) return false;
    if (!googleHitClearsMapFloors(hit, cfg.map)) return false;
    return !(minReviews > 0) || clearsMinReviews(hit.reviewCount, minReviews);
  });
}

/** Google Places, ranked, at most `limit`. */
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

  // The guest's stop and the operator's floor: the higher one cuts.
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

  // Distance first, so equal scores keep the nearer place ahead.
  const items = eligible
    .map((hit) => {
      const row = byGid.get(hit.placeId);
      const km = roundedKm(center, hit.lat, hit.lng);
      if (row) {
        const { google_place_id: _gid, ...rest } = row;
        return {
          km,
          place: {
            ...rest,
            distance_km: roundedKm(center, row.lat, row.lng) ?? km,
          } as Record<string, unknown>,
        };
      }
      return { km, place: googleStub(hit, km) };
    })
    .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));

  const ranked = rankByBlend(
    items,
    (item) => toMapLineupPlace(item.place),
    { lat: center.lat, lng: center.lng, now: deps.now, ...mapLineupIntent(types) },
    mapLineupWeights(deps.cfg),
    deps.cfg.params,
  );
  return {
    places: ranked.slice(0, deps.limit).map((r) => r.row.place),
    hits: hits.length,
  };
}

export type SelectedOpts = {
  /** The guest or camera, or null (no radius, no proximity). */
  center: Center | null;
  radiusKm: number;
  /** Guest family pills; empty or absent = every family. */
  families?: readonly string[];
  ranking: Record<CatalogRankKey, number>;
  params: SignalParams;
  /** Map's popularity floor on the Mesita lane, when the caller has one. */
  map?: MapConfig;
  limit?: number;
  now?: Date;
};

/**
 * Mesita Selected, ranked. The Selected signal (`enriched_at` set) is the
 * gate, so it ranks lexicographically first; `catalog.ranking`'s live keys
 * order inside it and distance breaks ties. No review floor exists here.
 */
export function selectMesitaSelected<T extends Record<string, unknown>>(
  rows: readonly T[],
  opts: SelectedOpts,
): Array<T & { distance_km: number | null }> {
  const { center } = opts;
  const families = opts.families ?? [];
  const intent = {
    lat: center?.lat ?? null,
    lng: center?.lng ?? null,
    now: opts.now,
  };
  const scored = rows
    .filter((row) =>
      catalogAdmitted(row as { enriched_at?: string | null; content_state?: string | null })
    )
    .map((row, index) => {
      const lat = typeof row.lat === "number" ? row.lat : null;
      const lng = typeof row.lng === "number" ? row.lng : null;
      const km = center ? roundedKm(center, lat, lng) : null;
      return { row, km, index };
    })
    .filter(({ km }) => !center || (km !== null && km <= opts.radiusKm))
    .filter(({ row }) =>
      families.length === 0 ||
      familiesForPlace(row).some((key) => families.includes(key))
    )
    .filter(({ row }) =>
      !opts.map ||
      listedClearsMapPopularity(row, opts.map, opts.params.popularity)
    )
    .map((s) => ({
      ...s,
      score: catalogScore(
        toLineupPlace(s.row),
        opts.ranking,
        opts.params,
        intent,
      ),
    }))
    .sort((a, b) =>
      b.score - a.score ||
      (a.km ?? Infinity) - (b.km ?? Infinity) ||
      a.index - b.index
    );
  const out = scored.map((s) => ({ ...s.row, distance_km: s.km }));
  return opts.limit === undefined ? out : out.slice(0, opts.limit);
}

/** The builder `selectedPoolQuery` needs (supabase-js satisfies it). */
export type SelectedPoolQuery<Q> =
  & DiscoveryFilterQuery<Q>
  & BboxQuery<Q>
  & { overlaps: (col: string, val: string[]) => Q };

/** A supabase-js select, seen structurally: what the two EFs hand
 *  `selectedPoolQuery` (the full generic type is too deep to infer). */
export interface PoolBuilder extends SelectedPoolQuery<PoolBuilder> {
  limit: (n: number) => PromiseLike<{
    data: unknown[] | null;
    error: { message: string } | null;
  }>;
}

/**
 * The Mesita Selected pool in SQL, the same on the Map and the Feed: the
 * operator filters with the Enriched gate forced on (`listedMapFilters`),
 * Discovery › General, ready, the guest's families, and the radius box
 * around the centre. Each predicate is a cut BEFORE the row cap, so a dense
 * area is not filled with rows `selectMesitaSelected` would drop.
 */
export function selectedPoolQuery<Q extends SelectedPoolQuery<Q>>(
  query: Q,
  cfg: Pick<DiscoveryConfig, "filters" | "map" | "general">,
  opts: { center: Center | null; radiusKm: number; families?: readonly string[] },
): Q {
  let q = applyDiscoveryFilters(query, listedMapFilters(cfg.filters, cfg.map), {
    lat: null,
    lng: null,
  });
  q = applyGeneralGateQuery(q, cfg.general).eq("content_state", "ready");
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
