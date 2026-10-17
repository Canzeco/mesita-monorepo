// Supabase Edge Function — consumer-web-list-catalog (product caller)
//
// The CATALOG engine. One round trip: every active, ready Mesita place,
// then one shared ranking profile, then N + 2 rails (MESITA-2294):
// Right Now (Created Places open now), Universal (Enriched Places), then
// one rail per guest family (Enriched only). At most 5 places per rail.
// Each rail admits its own pool, so placesScope no longer narrows the
// fetch. Empty rails are omitted. A place in two families is in both.
//
// RIGHT NOW FROM GOOGLE (MESITA-2295). `{ google: true, lat, lng }` makes
// Right Now every Google place open now near the guest, 5 nearest, on
// Search's Google path (`_shared/right-now-google.ts`): the operator's
// `map.googleFill`, the per-IP Nearby ledger, a ~1 km cell cached for
// minutes, Mesita rows winning their own google_place_id, one photo per
// Google-only card. No location, a refusal or an error keeps the Mesita
// Created Places Right Now.
//
// Local:  supabase functions serve consumer-web-list-catalog
// Deploy: supabase functions deploy consumer-web-list-catalog

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJsonOr,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { stripInternal } from "../_shared/place-pool-shape.ts";
import type { PlaceProfileRow } from "../_shared/place-pool-shape.ts";
import { PLACE_CARD_COLUMNS } from "../_shared/place-columns.ts";
import { loadDiscoveryConfig } from "../_shared/discovery-config.ts";
import {
  DISCOVERY_EXTRA_COLUMNS,
  toLineupPlace,
} from "../_shared/discovery-place.ts";
import {
  type CatalogListPlace,
  rankCatalogRails,
  withGoogleRightNow,
} from "../_shared/catalog-rank.ts";
import { decideNearby, wantsGoogleFill } from "../_shared/geo.ts";
import { mapShouldFillGoogle } from "../_shared/map-engine.ts";
import { readGooglePlacesKey } from "../_shared/google-places.ts";
import { consumeNearbyGoogleQuota } from "../_shared/nearby-google-quota.ts";
import { hashConnectingIp } from "../_shared/connecting-ip.ts";
import {
  rightNowGooglePlaces,
  type RightNowOwnedRow,
} from "../_shared/right-now-google.ts";
import {
  applyDeckPredicates,
  readDeckPredicates,
} from "../_shared/discovery-predicates.ts";

const POOL_CAP = 1000;

type Body = {
  lat?: number;
  lng?: number;
  /** Right Now from Google, as Search's opt-in. */
  google?: boolean;
  /** Deck predicates. Family, a review floor, and placesScope are ignored. */
  predicates?: unknown;
};

function wirePlaces(rows: PlaceProfileRow[]): CatalogListPlace[] {
  return rows.map((r) => {
    const out = stripInternal(r);
    return {
      ...out,
      id: r.id,
      photos: Array.isArray(out.photos) ? out.photos : [],
    };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const env = envRes.env;

  const body = await readJsonOr<Body>(req, {});
  const admin = adminClient(env);
  const cfg = await loadDiscoveryConfig(admin);
  const geo = {
    lat: typeof body.lat === "number" ? body.lat : null,
    lng: typeof body.lng === "number" ? body.lng : null,
  };

  const { data, error } = await admin
    .from("profiles")
    .select(`${PLACE_CARD_COLUMNS}, ${DISCOVERY_EXTRA_COLUMNS}`)
    .eq("state", "active")
    .eq("content_state", "ready")
    .limit(POOL_CAP);

  if (error) {
    console.error("[list-catalog] pool:", error.message);
    return json({ ok: false, error: error.message }, 502);
  }

  const fetched = (data ?? []) as unknown as PlaceProfileRow[];
  const guestPredicates = {
    ...readDeckPredicates(body.predicates),
    familyKeys: [],
    minReviews: 0,
  };
  const pool = applyDeckPredicates(
    fetched as unknown as Record<string, unknown>[],
    guestPredicates,
  ) as unknown as PlaceProfileRow[];

  const wired = wirePlaces(pool);
  const signals = pool.map((row) =>
    toLineupPlace(row as unknown as Record<string, unknown>)
  );
  const ranked = rankCatalogRails(
    wired,
    signals,
    cfg.catalog.ranking,
    cfg.params,
    { lat: geo.lat, lng: geo.lng, now: new Date() },
  );

  const nearby = decideNearby(body as Record<string, unknown>);
  const googleOn = nearby.mode === "ok" &&
    mapShouldFillGoogle(wantsGoogleFill(body as Record<string, unknown>), cfg.map);
  const gmp = googleOn ? readGooglePlacesKey() : null;
  const googleRightNow = googleOn && nearby.mode === "ok"
    ? await rightNowGooglePlaces<RightNowOwnedRow>({
      apiKey: gmp?.ok ? gmp.key : null,
      center: { lat: nearby.lat, lng: nearby.lng },
      consumeQuota: async () => {
        const ipHash = await hashConnectingIp(req, env.serviceKey);
        return (await consumeNearbyGoogleQuota(admin, ipHash)).allow;
      },
      lookupOwned: async (gids) => {
        const owned = await admin
          .from("profiles")
          .select(`${PLACE_CARD_COLUMNS}, google_place_id`)
          .eq("state", "active")
          .eq("content_state", "ready")
          .in("google_place_id", gids);
        if (owned.error) {
          console.error("[list-catalog] right now owned:", owned.error.message);
          return null;
        }
        return wirePlaces(
          (owned.data ?? []) as unknown as PlaceProfileRow[],
        ) as RightNowOwnedRow[];
      },
    })
    : null;
  const rails = withGoogleRightNow(
    ranked,
    googleRightNow as CatalogListPlace[] | null,
  );

  return json({
    ok: true,
    rails,
    summary: {
      pool: pool.length,
      lists: rails.length,
      rightNow: googleRightNow ? "google" : "mesita",
    },
  });
});
