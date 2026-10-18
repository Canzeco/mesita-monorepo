// Supabase Edge Function — consumer-web-list-places
//
// The Map view of the Area pipeline: web Search's pins. Public endpoint:
// returns places visible to consumers (state 'active'). Self-contained: no
// calls to other functions.
//
// TWO CLIENTS, ON PURPOSE (MESITA-1276). The PLACES query stays on the ANON
// client because RLS is the single source of truth for what a consumer may
// see, and routing it through service-role would quietly move that decision
// out of the database. The CONFIG read uses an admin client because
// `app_config` is EF-only locked down — anon cannot read it, and
// `loadDiscoveryConfig` swallows read errors and returns defaults, so an anon
// read here would look like it worked while enforcing nothing. A config that
// silently falls back is not enforced, which is the house definition of a bug.
//
// ONE REQUEST SHAPE — POST { google: true, lat, lng, placesScope,
// familyKeys, minReviews }: web Search, the Map view of the AREA PIPELINE
// (MESITA-2302, MESITA-2327, `_shared/area-pipeline.ts`), one scope at a
// time:
//   google    `selectGooglePlaces` — ONE Nearby Search (New) call, or a warm
//             cell, inside the operator's `map.radiusKm` for the families'
//             primary types. After Google answers: inside the radius,
//             Discovery › General's active check, and the higher of the
//             guest's Google Reviews stop and `map.googleMinReviews`. A hit a
//             ready Mesita row owns goes out as that row, the rest as
//             Google-only stubs, ranked by the Area score. No Mesita backfill
//             and no fallback to Selected: Google off, no key, a quota
//             refusal or an error is an empty answer.
//   selected  `selectedPoolQuery` + `selectMesitaSelected` — enriched, ready,
//             active rows inside the same radius, ranked by the Area score;
//             no review floor of any kind.
// How many is operator `map.pinCount` (Google is at most one call's 20); the
// circle is `map.radiusKm`; a client sets neither. Absent and retired scope
// words land on `selected`.
//
// Anything else is refused: a GET is 405, a POST without `google: true` or
// without a lat/lng pair is 400. The listed `{ lat, lng }` lane and the
// GET / `{ limit }` newest-first lane retired with their last callers, and
// `discovery_config.filters` with them (MESITA-2337).
//
// Local:  supabase functions serve consumer-web-list-places
// Deploy: supabase functions deploy consumer-web-list-places

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  clampIntRange,
  corsPreflight,
  json,
  readJsonOr,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import {
  adminClient,
  anonClient,
  readAnonEnv,
  readEFEnv,
} from "../_shared/auth.ts";
import { PLACE_CARD_COLUMNS } from "../_shared/place-columns.ts";
import { withFamilyKeysList } from "../_shared/place-family-keys.ts";
import { nearbyTypesForSupers } from "../_shared/google-type-super.ts";
import { readGuestFamilyKeys } from "../_shared/place-taxonomy.ts";
import { loadDiscoveryConfig } from "../_shared/discovery-config.ts";
import { DISCOVERY_DEFAULTS } from "../_shared/discovery-config.ts";
import {
  enabledNearbyTypes,
  guestReviewFloor,
  mapShouldFillGoogle,
} from "../_shared/map-engine.ts";
import {
  decideNearby,
  NEARBY_SCAN_LIMIT,
  wantsGoogleFill,
} from "../_shared/geo.ts";
import {
  GOOGLE_NEARBY_MAX,
  parsePlacesScope,
} from "../_shared/nearby-places.ts";
import {
  type OwnedRow,
  type PoolBuilder,
  selectedPoolQuery,
  selectGooglePlaces,
  selectMesitaSelected,
} from "../_shared/area-pipeline.ts";
import { consumeNearbyGoogleQuota } from "../_shared/nearby-google-quota.ts";
import { hashConnectingIp } from "../_shared/connecting-ip.ts";
import { readGooglePlacesKey } from "../_shared/google-places.ts";

const MAX_LIMIT = 200;

type ListBody = {
  limit?: number;
  nearby?: boolean;
  google?: boolean;
  placesScope?: unknown;
  /** Legacy ordinal wire (pre-2026-09-05 clients). */
  searchPower?: number;
  familyKeys?: unknown;
  /** Guest Popularity stop. Discovery-mode, not a Nearby API param. */
  minReviews?: unknown;
  lat?: number;
  lng?: number;
  radiusKm?: number;
};

type CardRow = {
  id: string;
  google_place_id?: string | null;
  name?: string | null;
  google_name?: string | null;
  category?: string | null;
  content_state?: string | null;
  enriched_at?: string | null;
  lat?: number | null;
  lng?: number | null;
  distance_km?: number | null;
  google_stars_overall?: number | null;
  google_review_count?: number | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readAnonEnv();
  if (!envRes.ok) return envRes.response;

  // Anon client is sufficient: the places RLS policy already restricts SELECT
  // to listed rows (state 'active') for anon + authenticated. This is the
  // single source of truth for what consumers are allowed to see.
  const supabase = anonClient(envRes.env);

  const body = await readJsonOr<ListBody>(req, {});
  const nearbyDecision = decideNearby(body as Record<string, unknown>);
  if (nearbyDecision.mode === "invalid") {
    return json({
      ok: false,
      error: "nearby needs finite lat and lng",
      code: "invalid_nearby",
    }, 400);
  }
  // `google: true` is web Search saying it can render a Google-only stub.
  // It is the only caller left, so a call without it, or without a centre,
  // has nothing to answer (MESITA-2337).
  if (
    nearbyDecision.mode !== "ok" ||
    !wantsGoogleFill(body as Record<string, unknown>)
  ) {
    return json({
      ok: false,
      error: "list-places answers web Search only: POST { google: true, lat, lng }",
      code: "web_search_only",
    }, 400);
  }
  // The named wire wins; a legacy client's ordinal is the fallback. Silence
  // is the Google scope, web Search's own default.
  const scopeFromClient = body.placesScope !== undefined ||
    body.searchPower !== undefined;
  const placesScope = scopeFromClient
    ? parsePlacesScope(body.placesScope ?? body.searchPower)
    : "google";
  const guestSupers = readGuestFamilyKeys(body.familyKeys);
  const rawMinReviews: unknown = body.minReviews;

  // The engine (area-pipeline.ts) applies the active check and the reviews
  // floors. Google fill is client opt-in AND operator googleFill AND at
  // least one family on. HOW MANY PINS is `map.pinCount`; Google hands back
  // at most 20 per call and the engine never widens (MESITA-2298). The
  // guest's Google Reviews stop (`minReviews`) cuts Google hits after
  // Google's response, never as a Nearby API param.
  const efEnv = readEFEnv();
  const cfg = efEnv.ok
    ? await loadDiscoveryConfig(adminClient(efEnv.env))
    : DISCOVERY_DEFAULTS;
  // A caller that names its own cap keeps it; one that names none (web
  // Search) takes the operator's `map.pinCount`.
  const limit = typeof body.limit === "number"
    ? clampIntRange(body.limit, 1, MAX_LIMIT)
    : clampIntRange(cfg.map.pinCount, 1, MAX_LIMIT);
  // A GUEST PILL OUTRANKS THE FULL BATTERY, deliberately (MESITA-1685). The
  // pill IS the guest's question. With no pill, Nearby asks for every guest
  // family. Stored family switches are not read. The operator still holds
  // googleFill, the floors, and the rate controls.
  const nearbyTypes = guestSupers.length > 0
    ? nearbyTypesForSupers(guestSupers)
    : enabledNearbyTypes(cfg.map);
  const googleFill = mapShouldFillGoogle(true, cfg.map) &&
    nearbyTypes.length > 0;
  // WEB SEARCH: the shared engine answers, one scope at a time.
  const center = { lat: nearbyDecision.lat, lng: nearbyDecision.lng };
  const radiusKm = cfg.map.radiusKm;
  let places: Array<Record<string, unknown>> = [];
  let googleHits: number | null = null;
  if (placesScope === "google") {
    const gmp = googleFill ? readGooglePlacesKey() : null;
    const selection = await selectGooglePlaces<OwnedRow>({
      apiKey: gmp?.ok && efEnv.ok ? gmp.key : null,
      center,
      radiusKm,
      types: googleFill ? nearbyTypes : [],
      families: guestSupers,
      minReviews: guestReviewFloor(placesScope, rawMinReviews),
      limit: Math.min(limit, GOOGLE_NEARBY_MAX),
      cfg,
      consumeQuota: async () => {
        if (!efEnv.ok) return false;
        // Identity is CF-Connecting-IP / rightmost XFF, never the
        // spoofable leftmost hop; only a billed miss mints a row.
        const ipHash = await hashConnectingIp(req, efEnv.env.serviceKey);
        const quota = await consumeNearbyGoogleQuota(
          adminClient(efEnv.env),
          ipHash,
        );
        return quota.allow;
      },
      // ONE lookup by google_place_id, ready rows only (RLS limits it to
      // listed rows), the same set the Feed's lookup reads: a hit a ready
      // Mesita row owns goes out as that row, never a stub (MESITA-2154). An
      // owned row that is not ready stays a stub, and its tap's get-or-create
      // opens the Mesita place.
      lookupOwned: async (gids) => {
        const owned = await (supabase
          .from("profiles")
          .select(`${PLACE_CARD_COLUMNS}, google_place_id`)
          .eq("content_state", "ready") as unknown as {
            in: (
              col: string,
              vals: string[],
            ) => PromiseLike<
              { data: unknown[] | null; error: { message: string } | null }
            >;
          }).in("google_place_id", gids);
        if (owned.error) {
          console.error(
            "[consumer-web-list-places] owned gid lookup:",
            owned.error.message,
          );
          return null;
        }
        return (owned.data ?? []) as OwnedRow[];
      },
    });
    places = selection.places;
    googleHits = selection.hits;
  } else {
    const pool = await selectedPoolQuery(
      supabase.from("profiles").select(PLACE_CARD_COLUMNS) as unknown as PoolBuilder,
      cfg,
      { center, radiusKm, families: guestSupers },
    ).limit(NEARBY_SCAN_LIMIT);
    if (pool.error) {
      return json({ ok: false, error: pool.error.message }, 500);
    }
    places = selectMesitaSelected(
      (pool.data ?? []) as Array<Record<string, unknown>>,
      {
        center,
        radiusKm,
        families: guestSupers,
        params: cfg.params,
        limit,
      },
    );
  }
  // One line, because every failure mode of a scope is a WRONG SET rather
  // than an error: a skewed client, Google switched off and a spent quota
  // all look like a thin catalog from the outside.
  console.log(JSON.stringify({
    fn: "consumer-web-list-places",
    mode: "nearby",
    scope: placesScope,
    googleFillOn: googleFill,
    googleHits,
    returned: places.length,
    limit,
  }));
  return json({
    ok: true,
    places: withFamilyKeysList(places as CardRow[]),
    mode: "nearby",
    reloadMinKm: cfg.map.reloadMinKm,
    reloadMinSec: cfg.map.reloadMinSec,
  });
});
