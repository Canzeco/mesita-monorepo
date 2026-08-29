// Supabase Edge Function — consumer-web-recommend-swipe (product caller)
//
// The SWIPE engine — the Home deck (Docs › Discovery §B).
//
// Hard filters admit; a two-signal SUM scores; partner bias multiplies after
// (Pato, 2026-08-26). This replaces the nine-signal blend + bought slots for
// Swipe only. Catalog, Chat and Social stay pending.
//
//   1. ADMIT  — enriched (content_status ready), reviews floor, fixed radius,
//               Map type batteries, open now + closing buffer, then the
//               guest's predicates (category is the guest toggle).
//   2. SCORE  —  wP * proximity + (1 − wP) * popularity. Linear proximity.
//   3. BIAS   —  partner multiplier, five levels.
//   4. JITTER —  Uniform[1, randomnessMax] per place, then order.
//
// Partner bias cannot live inside the spatial index. Fetch the admitted pool
// first, then score, then bias, then order. Do not pre-order by distance and
// cut.
//
// THE SLUG AND THE RESPONSE SHAPE ARE STILL FROZEN. Deployed Expo binaries call
// this endpoint and cannot be redeployed atomically. Keep returning
// { ok, deck, summary: { candidates, embedded } }.
//
// `lat` / `lng` feed Proximity and the radius. `radiusKm` and `randomness`
// stay discarded — both are operator policy on discovery_config.swipe.
// Optional `predicates` still cut inside the operator's filters
// (MESITA-1153). A client that omits them — every deployed Expo binary —
// gets the operator pool.
//
// Local:  supabase functions serve consumer-web-recommend-swipe
// Deploy: supabase functions deploy consumer-web-recommend-swipe

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { clampPositive, stripInternal } from "../_shared/place-pool-shape.ts";
import type { PlaceRow } from "../_shared/place-pool-shape.ts";
import { PLACE_CARD_COLUMNS } from "../_shared/place-columns.ts";
import {
  applyGeneralCategoryCap,
  loadDiscoveryConfig,
} from "../_shared/discovery-config.ts";
import { DISCOVERY_EXTRA_COLUMNS } from "../_shared/discovery-place.ts";
import { applyDiscoveryFilters, trimToRadius } from "../_shared/discovery-filters.ts";
import {
  applyDeckPredicates,
  readDeckPredicates,
} from "../_shared/discovery-predicates.ts";
import { admitSwipeCatalog } from "../_shared/map-engine.ts";
import {
  admitSwipeTiming,
  rankSwipeDeck,
  swipeAdmissionFilters,
} from "../_shared/discovery-swipe.ts";
import type { PromotingFields } from "../_shared/place-promoting.ts";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 50;
const POOL_CAP = 1000;

type Body = {
  lat?: number;
  lng?: number;
  /** Accepted for wire compatibility. Ignored — operator owns radius. */
  radiusKm?: number;
  limit?: number;
  /** Accepted for wire compatibility. Ignored — operator owns randomnessMax. */
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

  const cfg = applyGeneralCategoryCap(await loadDiscoveryConfig(admin));
  const geo = {
    lat: typeof body.lat === "number" ? body.lat : null,
    lng: typeof body.lng === "number" ? body.lng : null,
  };

  const base = admin
    .from("profiles")
    .select(`${PLACE_CARD_COLUMNS}, ${DISCOVERY_EXTRA_COLUMNS}`)
    .eq("status", "active");

  // Swipe owns radius / reviews / ready. Map floors stay off this query so a
  // Map rating knob cannot empty the deck this engine just scored.
  const filters = swipeAdmissionFilters(cfg.swipe);
  const { data, error } = await applyDiscoveryFilters(base, filters, geo)
    .limit(POOL_CAP);

  if (error) {
    console.error("[recommend-swipe] pool:", error.message);
    return json({ ok: false, error: error.message }, 502);
  }

  const admitted = (data ?? []) as unknown as PlaceRow[];
  const pool = trimToRadius(
    admitted,
    (r) => (r as unknown as Record<string, unknown>).lat as number | null,
    (r) => (r as unknown as Record<string, unknown>).lng as number | null,
    filters.maxDistanceKm,
    geo,
  );
  // Type batteries only — listed Mesita restaurants/bars/cafes/etc. Floors
  // on map stay Map's. Reviews already ran as a query predicate.
  const typed = admitSwipeCatalog(pool, {
    ...cfg.map,
    minRating: 0,
    minReviews: 0,
    minPopularity: 0,
  });
  const open = admitSwipeTiming(
    typed,
    (r) => (r as unknown as Record<string, unknown>).hours,
    (r) => (r as unknown as Record<string, unknown>).lng as number | null,
    cfg.swipe.closingBufferMin,
  );

  const rows = applyDeckPredicates(
    open as unknown as Record<string, unknown>[],
    readDeckPredicates(body.predicates),
    geo.lat !== null && geo.lng !== null
      ? { lat: geo.lat, lng: geo.lng }
      : null,
  ) as unknown as PlaceRow[];

  const guestGeo = geo.lat !== null && geo.lng !== null
    ? { lat: geo.lat, lng: geo.lng }
    : null;

  const ordered = cfg.engines.swipe.ranked
    ? rankSwipeDeck(
      rows,
      guestGeo,
      cfg.swipe,
      {
        latOf: (r) => (r as unknown as Record<string, unknown>).lat as number | null,
        lngOf: (r) => (r as unknown as Record<string, unknown>).lng as number | null,
        starsOf: (r) =>
          (r as unknown as Record<string, unknown>).google_stars_overall as number | null,
        reviewsOf: (r) =>
          (r as unknown as Record<string, unknown>).google_review_count as number | null,
        partnerOf: (r) => r as unknown as PromotingFields,
      },
    )
    : rows;

  const deck = ordered.slice(0, limit).map((r) => stripInternal(r));
  const embedded = rows.filter((r) =>
    (r as unknown as Record<string, unknown>).embedding != null
  ).length;

  return json({
    ok: true,
    deck,
    summary: { candidates: rows.length, embedded },
  });
});
