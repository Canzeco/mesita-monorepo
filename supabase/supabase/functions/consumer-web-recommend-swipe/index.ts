// Supabase Edge Function — consumer-web-recommend-swipe (product caller)
//
// The SWIPE engine — the Home deck (Docs › Discovery §B).
//
// Hard filters admit; two soft gates band; Places Lineup ranks each band under
// the locked Swipe mask (Pato, 2026-08-28). The 2026-08-26 two-signal SUM is
// gone.
//
//   1. ADMIT  — enriched (content_state ready), reviews floor, Map type
//               batteries, then the guest's predicates. These EXCLUDE.
//   2. TIER   — open now + closing buffer, the operator radius, and the
//               Proximity reach. These BAND and never exclude (MESITA-2047):
//               open-and-near leads, then open within reach, closed within
//               reach, beyond reach (nearest first), unplaced. A catalog of
//               one place that is shut tonight still serves that place.
//   3. RANK   — Places Lineup Π s^w inside each band: proximity, timing,
//               category, popularity, enriched, partnered, randomness.
//               Name / Summary / Social stay off. Then the bought slots,
//               also inside each band.
//
// Partner bias cannot live inside the spatial index. Fetch the admitted pool
// first, then rank. Do not pre-order by distance and cut.
//
// THE RADIUS IS STILL THE FIRST QUERY'S BOX. A located guest whose radius
// cannot fill the deck gets wider asks — the reach box, 500 km, then no box —
// each only while the bands no farther place could outrank hold fewer than
// the deck (`widenSwipePool`). At 50 OPEN places inside the radius none runs.
//
// BUILDS OLDER THAN MESITA-2047 re-sort the deck partners-first on the
// client, so until a device takes the update a closed partner can lead there.
//
// THE SLUG AND THE RESPONSE SHAPE ARE STILL FROZEN. Deployed Expo binaries call
// this endpoint and cannot be redeployed atomically. Keep returning
// { ok, deck, summary: { candidates, embedded } }. `candidates` is still the
// strict (open, in-radius) pool; `summary.backfilled` is additive.
//
// `lat` / `lng` feed Proximity and the radius. `radiusKm` and `randomness`
// stay discarded — both are operator policy on discovery_config.swipe
// (radius) and Places Lineup (randomness exponent). Optional `predicates`
// still cut inside the operator's filters (MESITA-1153). A client that
// omits them — every deployed Expo binary — gets the operator pool.
//
// Local:  supabase functions serve consumer-web-recommend-swipe
// Deploy: supabase functions deploy consumer-web-recommend-swipe

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { clampPositive, stripInternal } from "../_shared/place-pool-shape.ts";
import type { PlaceProfileRow } from "../_shared/place-pool-shape.ts";
import { PLACE_CARD_COLUMNS } from "../_shared/place-columns.ts";
import {
  loadDiscoveryConfig,
} from "../_shared/discovery-config.ts";
import {
  attachCrenupHighWater,
  DISCOVERY_EXTRA_COLUMNS,
} from "../_shared/discovery-place.ts";
import { applyDiscoveryFilters } from "../_shared/discovery-filters.ts";
import { NEARBY_DEFAULT_RADIUS_KM } from "../_shared/geo.ts";
import {
  applyDeckPredicates,
  readDeckPredicates,
} from "../_shared/discovery-predicates.ts";
import { admitSwipeCatalog } from "../_shared/map-engine.ts";
import {
  fillSwipeDeck,
  partitionSwipeTiers,
  rankSwipeDeck,
  swipeAdmissionFilters,
  swipeDistanceKm,
  swipeLineupWeights,
  swipeReachKm,
  widenSwipePool,
} from "../_shared/discovery-swipe.ts";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 50;
const POOL_CAP = 1000;
/**
 * Where a located guest looks when their radius cannot fill the deck, after
 * the reach box: the Search map's default reach, then the whole catalog
 * (0 = no box). Stepping out keeps each ask as close as it can be, but a ring
 * past POOL_CAP rows is still an arbitrary 1000 of them — PostgREST cannot
 * order by distance before the cap bites. That only matters once one ring
 * holds 1000+ ready places and the rings inside it fewer than 50.
 */
const OUTER_RINGS_KM = [NEARBY_DEFAULT_RADIUS_KM, 0] as const;

type Body = {
  lat?: number;
  lng?: number;
  /** Accepted for wire compatibility. Ignored — operator owns radius. */
  radiusKm?: number;
  limit?: number;
  /** Accepted for wire compatibility. Ignored — Lineup owns randomness. */
  randomness?: number;
  predicates?: unknown;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const env = envRes.env;

  const body = await readJsonOr<Body>(req, {});
  const limit = clampPositive(body.limit, DEFAULT_LIMIT, MAX_LIMIT);

  const admin = adminClient(env);

  const cfg = await loadDiscoveryConfig(admin);
  const geo = {
    lat: typeof body.lat === "number" ? body.lat : null,
    lng: typeof body.lng === "number" ? body.lng : null,
  };

  const guestGeo = geo.lat !== null && geo.lng !== null
    ? { lat: geo.lat, lng: geo.lng }
    : null;

  // Swipe owns radius / reviews / ready. Map floors stay off this query so a
  // Map rating knob cannot empty the deck this engine just scored.
  const filters = swipeAdmissionFilters(cfg.swipe);
  const poolQuery = async (maxDistanceKm: number) => {
    const base = admin
      .from("profiles")
      .select(`${PLACE_CARD_COLUMNS}, ${DISCOVERY_EXTRA_COLUMNS}`)
      .eq("state", "active");
    const { data, error } = await applyDiscoveryFilters(
      base,
      { ...filters, maxDistanceKm },
      geo,
    ).limit(POOL_CAP);
    return {
      data: (data ?? []) as unknown as PlaceProfileRow[],
      error,
    };
  };

  const { data: pool, error } = await poolQuery(filters.maxDistanceKm);
  if (error) {
    console.error("[recommend-swipe] pool:", error.message);
    return json({ ok: false, error: error.message }, 502);
  }

  const predicates = readDeckPredicates(body.predicates);
  // The exclusions: type batteries (listed Mesita restaurants/bars/cafes/etc.
  // — Map's floors stay Map's; reviews already ran as a query predicate), then
  // the guest's own predicates. A guest who asked for "open now" or a max
  // distance keeps that promise; only the operator's gates are tiered.
  const admit = (rows: PlaceProfileRow[]) =>
    applyDeckPredicates(
      admitSwipeCatalog(rows, {
        ...cfg.map,
        minRating: 0,
        minReviews: 0,
        minPopularity: 0,
      }) as unknown as Record<string, unknown>[],
      predicates,
      guestGeo,
    ) as unknown as PlaceProfileRow[];
  const reachKm = swipeReachKm(filters.maxDistanceKm, cfg.params);
  const tiersOf = (rows: PlaceProfileRow[]) =>
    partitionSwipeTiers(rows, {
      geo: guestGeo,
      radiusKm: filters.maxDistanceKm,
      reachKm,
      bufferMin: cfg.swipe.closingBufferMin,
      hoursOf: (r) => r.hours,
      latOf: (r) => r.lat,
      lngOf: (r) => r.lng,
    });

  // Wider asks only for a located guest the radius box left short. Without
  // coordinates the first query was never boxed, so it already holds every
  // row the tiers could use.
  const admitted = guestGeo
    ? await widenSwipePool({
      limit,
      admitted: admit(pool),
      seen: new Set(pool.map((r) => r.id)),
      radiusKm: filters.maxDistanceKm,
      reachKm,
      rings: [reachKm, ...OUTER_RINGS_KM],
      fetchRing: async (km) => {
        const wider = await poolQuery(km);
        if (wider.error) {
          console.error("[recommend-swipe] wider pool:", wider.error.message);
          return null;
        }
        return wider.data;
      },
      idOf: (r) => r.id,
      admit,
      tiersOf,
      distanceOf: (r) => swipeDistanceKm(guestGeo, r.lat, r.lng),
    })
    : admit(pool);
  const tiers = tiersOf(admitted);

  const { deck: ordered, backfilled } = await fillSwipeDeck(
    tiers,
    limit,
    async (tierRows) =>
      cfg.engines.swipe.ranked
        ? rankSwipeDeck(
          // The `enriched` gradient (MESITA-1598) needs `crenup_high_water`
          // on the row — `profiles` doesn't carry it, so one batched side-read
          // per band merges it in before ranking. Skipped entirely when
          // ranking is off, and never run for a band the deck has no room for.
          await attachCrenupHighWater(
            admin,
            tierRows as unknown as Record<string, unknown>[],
          ),
          guestGeo,
          swipeLineupWeights(cfg),
          // The bought lane, live since MESITA-1855. `ranked: false` already
          // bypasses this whole branch, so slotting never runs on pool order.
          cfg.slotting,
          cfg.params,
          {
            categories: predicates.categories,
            families: predicates.familyKeys,
          },
        ) as PlaceProfileRow[]
        // Ranking off still bands: admission, tiers and ordering are three
        // different questions, and "off" only answers the last one.
        : tierRows,
  );

  const deck = ordered.map((r) => stripInternal(r));
  const embedded = tiers.strict.filter((r) => r.embedding != null).length;

  return json({
    ok: true,
    deck,
    summary: { candidates: tiers.strict.length, embedded, backfilled },
  });
});
