// Supabase Edge Function — consumer-web-list-catalog (product caller)
//
// The CATALOG engine, on the shared discovery engine (MESITA-2302,
// `_shared/nearby-selection.ts`). One round trip, three kinds of rail:
//   1. Google Places — `selectGooglePlaces`, the Map's Google scope: ONE
//      Nearby Search (New) call inside `map.radiusKm` around the guest,
//      eligibility after Google answers (General · Map floors · the central
//      Google Reviews floor, default 100+), Mesita rows winning their own
//      google_place_id, Google-only cards with no photo. Needs
//      `{ google: true, lat, lng }`, the operator's `map.googleFill`, a key
//      and the per-IP ledger; any refusal omits the rail.
//   2. Mesita Selected — `selectMesitaSelected`, the Map's Selected scope:
//      enriched, ready rows inside the same radius, ranked on
//      `catalog.ranking`. Without a location, the whole capped pool, ranked
//      on popularity alone.
//   3. One rail per guest family, Mesita Selected places only.
// At most `catalog.railCap` places per rail (default 5); empty rails are omitted. Right Now, Universal
// and the guest deck filters are gone: the Feed sends none.
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
import { DISCOVERY_EXTRA_COLUMNS } from "../_shared/discovery-place.ts";
import {
  buildCatalogRails,
  type CatalogListPlace,
} from "../_shared/catalog-rank.ts";
import { decideNearby, wantsGoogleFill } from "../_shared/geo.ts";
import {
  guestReviewFloor,
  mapShouldFillGoogle,
} from "../_shared/map-engine.ts";
import { readGooglePlacesKey } from "../_shared/google-places.ts";
import { consumeNearbyGoogleQuota } from "../_shared/nearby-google-quota.ts";
import { hashConnectingIp } from "../_shared/connecting-ip.ts";
import {
  FEED_GOOGLE_TYPES,
  type OwnedRow,
  type PoolBuilder,
  selectedPoolQuery,
  selectGooglePlaces,
  selectMesitaSelected,
} from "../_shared/nearby-selection.ts";

const POOL_CAP = 1000;

type Body = {
  lat?: number;
  lng?: number;
  /** Rail 1 may buy Google Places, as Search's opt-in. */
  google?: boolean;
  /** The central Google Reviews floor for rail 1 (absent = 100+). */
  minReviews?: unknown;
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
  const nearby = decideNearby(body as Record<string, unknown>);
  const center = nearby.mode === "ok"
    ? { lat: nearby.lat, lng: nearby.lng }
    : null;
  const radiusKm = cfg.map.radiusKm;

  const { data, error } = await selectedPoolQuery(
    admin
      .from("profiles")
      .select(`${PLACE_CARD_COLUMNS}, ${DISCOVERY_EXTRA_COLUMNS}`)
      .eq("state", "active") as unknown as PoolBuilder,
    cfg,
    { center, radiusKm },
  ).limit(POOL_CAP);

  if (error) {
    console.error("[list-catalog] pool:", error.message);
    return json({ ok: false, error: error.message }, 502);
  }

  const now = new Date();
  const selected = selectMesitaSelected(
    wirePlaces((data ?? []) as unknown as PlaceProfileRow[]),
    {
      center,
      radiusKm,
      ranking: cfg.catalog.ranking,
      params: cfg.params,
      map: cfg.map,
      now,
    },
  );

  const googleOn = center !== null &&
    mapShouldFillGoogle(wantsGoogleFill(body as Record<string, unknown>), cfg.map);
  const gmp = googleOn ? readGooglePlacesKey() : null;
  const google = googleOn
    ? await selectGooglePlaces<OwnedRow>({
      apiKey: gmp?.ok ? gmp.key : null,
      center,
      radiusKm,
      types: FEED_GOOGLE_TYPES,
      minReviews: guestReviewFloor("google", body.minReviews),
      limit: cfg.catalog.railCap,
      cfg,
      now,
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
          console.error("[list-catalog] owned:", owned.error.message);
          return null;
        }
        return wirePlaces(
          (owned.data ?? []) as unknown as PlaceProfileRow[],
        ) as OwnedRow[];
      },
    })
    : { places: [], hits: 0 };
  const rails = buildCatalogRails(google.places, selected, cfg.catalog.railCap);

  return json({
    ok: true,
    rails,
    summary: {
      pool: data?.length ?? 0,
      lists: rails.length,
      google: google.places.length,
    },
  });
});
