// Supabase Edge Function — consumer-web-list-places
//
// The MAP engine's pool. Public endpoint: returns places visible to consumers
// (state 'active'). Self-contained: no calls to other functions.
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
// TWO POST SHAPES:
//   { lat, lng, limit? } — listed nearby (no `google: true`). Closest N of
//     Mesita Selected. Never a Google call, never a stub.
//   { google: true, lat, lng, placesScope, familyKeys, minReviews } — web
//     Search, a view of the AREA PIPELINE (MESITA-2302, MESITA-2327,
//     `_shared/area-pipeline.ts`), one scope at a time:
//       google    `selectGooglePlaces` — ONE Nearby Search (New) call inside
//                 the operator's `map.radiusKm`; General gate, Map floors
//                 and the guest Google Reviews floor cut AFTER Google
//                 answers; a hit Mesita owns goes out as that row, the rest
//                 as Google-only stubs; ranked on the Map column. No Mesita
//                 backfill and no fallback to Selected: Google off, no key,
//                 a quota refusal or an error is an empty answer.
//       selected  `selectedPoolQuery` + `selectMesitaSelected` — enriched,
//                 ready rows inside the same radius, ranked on
//                 `catalog.ranking`; no review floor of any kind.
//     How many is operator `map.pinCount` (Google is at most one call's
//     20); the circle is `map.radiusKm`; a client sets neither. Absent and
//     retired scope words land on `selected`.
//   { limit? } / GET — Pay / Home: global newest-first.
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
import {
  familiesForPlace,
  readGuestFamilyKeys,
} from "../_shared/place-taxonomy.ts";
import { loadDiscoveryConfig } from "../_shared/discovery-config.ts";
import { DISCOVERY_DEFAULTS } from "../_shared/discovery-config.ts";
import { applyDiscoveryFilters } from "../_shared/discovery-filters.ts";
import {
  applyGeneralGateQuery,
} from "../_shared/discovery-general-gate.ts";
import {
  admitMapCatalog,
  enabledNearbyTypes,
  guestReviewFloor,
  listedMapFilters,
  mapShouldFillGoogle,
} from "../_shared/map-engine.ts";
import {
  applyBboxPredicate,
  decideNearby,
  haversineKm,
  NEARBY_SCAN_LIMIT,
  nearbyBbox,
  wantsGoogleFill,
} from "../_shared/geo.ts";
import {
  admitsScopeRow,
  CATALOG_NEARBY_HARD_MAX,
  GOOGLE_NEARBY_MAX,
  mergeNearbyCatalog,
  parsePlacesScope,
  PLACES_SCOPE_DEFAULT,
  type PlacesScope,
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

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function roundedKm(
  lat: number,
  lng: number,
  rowLat: number | null | undefined,
  rowLng: number | null | undefined,
): number | null {
  const km = haversineKm(lat, lng, rowLat ?? null, rowLng ?? null);
  if (!Number.isFinite(km)) return null;
  return Math.round(km * 10) / 10;
}

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
  const methodReject = rejectUnlessMethods(req, "GET", "POST");
  if (methodReject) return methodReject;

  const envRes = readAnonEnv();
  if (!envRes.ok) return envRes.response;

  // Anon client is sufficient: the places RLS policy already restricts SELECT
  // to listed rows (state 'active') for anon + authenticated. This is the
  // single source of truth for what consumers are allowed to see.
  const supabase = anonClient(envRes.env);

  // Limit can come from a JSON body (POST from supabase.functions.invoke) or
  // a query string (?limit=… for raw GETs). Body wins if both are present.
  // Geo is POST-only. GET / omitted lat+lng (Pay, Home) stay newest-first.
  // Nearby (lat+lng) is Search's pool.
  let limit = DEFAULT_LIMIT;
  // A caller that names its own cap keeps it; one that names none takes the
  // operator's `map.pinCount` below. Two different silences, two answers.
  let limitFromClient = false;
  let scopeFromClient = false;
  let nearbyDecision: ReturnType<typeof decideNearby> = { mode: "none" };
  let clientGoogle = false;
  let placesScope: PlacesScope = PLACES_SCOPE_DEFAULT;
  let guestSupers: ReturnType<typeof readGuestFamilyKeys> = [];
  let rawMinReviews: unknown = undefined;
  if (req.method === "POST") {
    const body = await readJsonOr<ListBody>(req, {});
    if (typeof body.limit === "number") {
      limit = clampIntRange(body.limit, 1, MAX_LIMIT);
      limitFromClient = true;
    }
    nearbyDecision = decideNearby(body as Record<string, unknown>);
    clientGoogle = nearbyDecision.mode === "ok" &&
      wantsGoogleFill(body as Record<string, unknown>);
    // The named wire wins; a legacy client's ordinal is the fallback. Both
    // land on "mesita" when absent, never on the narrowest ring.
    scopeFromClient = body.placesScope !== undefined ||
      body.searchPower !== undefined;
    placesScope = parsePlacesScope(body.placesScope ?? body.searchPower);
    guestSupers = readGuestFamilyKeys(body.familyKeys);
    rawMinReviews = body.minReviews;
  } else {
    const q = Number(new URL(req.url).searchParams.get("limit"));
    if (Number.isFinite(q)) {
      limit = clampIntRange(q, 1, MAX_LIMIT);
      limitFromClient = true;
    }
  }

  if (nearbyDecision.mode === "invalid") {
    return json({
      ok: false,
      error: "nearby needs finite lat and lng",
      code: "invalid_nearby",
    }, 400);
  }

  // Nearby pool admission: global operator filters plus Map floors
  // (`discovery_config.map`). `filters.maxDistanceKm` is never applied here —
  // Nearby uses its own large radius + closest N of the selected Places
  // set. Pay / Home GET callers keep global filters only. Google
  // fill is client opt-in AND operator googleFill AND at least one Super on.
  // HOW MANY PINS is `map.pinCount`; Google hands back at most 20 per call
  // and the engine never widens (MESITA-2298). Guest Google Reviews
  // (`minReviews`) is a Discovery-mode floor on top, applied after Google's
  // response, never a Nearby API param.
  const efEnv = readEFEnv();
  const cfg = efEnv.ok
    ? await loadDiscoveryConfig(adminClient(efEnv.env))
    : DISCOVERY_DEFAULTS;
  const isNearby = nearbyDecision.mode === "ok";
  // Silence means the operator answers, and only for the web Search call.
  // `clientGoogle` is the tell: mobile Search and the Pay picker never send
  // `google: true`, so neither their cap nor their ring moves here.
  // Operator `map.pinCount` caps every nearby load unless the caller names
  // its own limit (Pay's 50-place picker). Mobile Search used to send 50
  // and silently beat a 60 stop; web Search omits limit and already won.
  if (isNearby && !limitFromClient) {
    limit = clampIntRange(cfg.map.pinCount, 1, MAX_LIMIT);
  }
  if (clientGoogle && !scopeFromClient) {
    placesScope = "google";
  }
  // A GUEST PILL OUTRANKS THE FULL BATTERY, deliberately (MESITA-1685). The
  // pill IS the guest's question. With no pill, Nearby asks for every guest
  // family. Stored family switches are not read. The operator still holds
  // googleFill, the floors, and the rate controls.
  const nearbyTypes = guestSupers.length > 0
    ? nearbyTypesForSupers(guestSupers)
    : enabledNearbyTypes(cfg.map);
  const googleFill = mapShouldFillGoogle(clientGoogle, cfg.map) &&
    nearbyTypes.length > 0;
  // WEB SEARCH: the shared engine answers, one scope at a time.
  if (clientGoogle && nearbyDecision.mode === "ok") {
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
        // ONE unfiltered lookup by google_place_id (RLS limits it to listed
        // rows): a hit Mesita owns is never a stub (MESITA-2154).
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
  }

  // The Mesita lane is Mesita Selected: the Enriched gate is always on
  // (MESITA-2298); `readyOnMap` keeps the ready cut in SQL either way.
  const filters = isNearby
    ? listedMapFilters(cfg.filters, cfg.map)
    : cfg.filters;
  // Mesita Places = listed (RLS) + `content_state = 'ready'`, on EVERY ring:
  // the inner ring's gate already carries it, and `admitsScopeRow` re-checks
  // each row. In SQL so a dense bbox is not filled with unshowable rows.
  const readyOnMap = <Q extends { eq: (col: string, val: unknown) => Q }>(
    q: Q,
  ): Q => q.eq("content_state", "ready");

  // MESITA-1283: list returns MANY places per request — the card projection
  // (every public column except the five enrichment-filled jsonb ones), not
  // the full single-place read. Nothing here reads those five; verified
  // against discovery-filters.ts and this file before wiring.
  const selectCols = PLACE_CARD_COLUMNS;
  const scanLimit = isNearby ? NEARBY_SCAN_LIMIT : limit;
  // THE ONE CIRCLE (MESITA-2298 §3, MESITA-2302): every nearby answer draws
  // the operator's `map.radiusKm`; a client never sets it.
  const nearbyRadiusKm = cfg.map.radiusKm;
  const base = supabase.from("profiles").select(selectCols);

  let filtered = applyDiscoveryFilters(base, filters, {
    lat: null,
    lng: null,
  });
  // Discovery › General — the post-Google wipe. SEARCH ONLY, deliberately:
  // this is the Map lane's answer to "only active places", and Pay / Home
  // callers keep `discovery_config.filters` exactly as before
  // (the same line `listedMapFilters` draws two statements up).
  if (isNearby) {
    filtered = readyOnMap(applyGeneralGateQuery(filtered, cfg.general));
  }
  // The guest Google Reviews floor NEVER touches the Mesita lane
  // (MESITA-2298 §2, MESITA-2305): it cuts Google hits after Google's
  // response, in `admitGuestMinReviews`, and nothing else.
  // Guest Family: family_keys on the row is the view's derived mapping.
  // overlaps so a dense bbox does not fill NEARBY_SCAN_LIMIT with the wrong
  // families. The JS pass uses those keys and does not invent a family.
  if (isNearby && guestSupers.length > 0) {
    filtered = (filtered as typeof filtered & {
      overlaps: (col: string, val: string[]) => typeof filtered;
    }).overlaps("family_keys", [...guestSupers]);
  }
  if (nearbyDecision.mode === "ok") {
    filtered = applyBboxPredicate(
      filtered,
      nearbyBbox(nearbyDecision.lat, nearbyDecision.lng, nearbyRadiusKm),
    );
  }

  // Nearby must not order by created_at. Newest-N drops an old listed
  // place from its lane (and, on web, lets Google paint it as a gray stub).
  // Pay / Home keep newest-first.
  const page = isNearby
    ? await filtered.limit(scanLimit)
    : await filtered.order("created_at", { ascending: false }).limit(scanLimit);
  const { data, error } = page;

  if (error) {
    return json({ ok: false, error: error.message }, 500);
  }

  // Listed nearby (no `google: true`): the closest N Mesita rows the scope
  // admits, inside the caller's circle. Never a Google call.
  if (nearbyDecision.mode === "ok") {
    const { lat, lng } = nearbyDecision;
    let mesitaRows = ((data ?? []) as unknown as CardRow[]).filter((row) =>
      admitsScopeRow(placesScope, row)
    );
    if (guestSupers.length > 0) {
      mesitaRows = mesitaRows.filter((row) =>
        guestSupers.some((key) => familiesForPlace(row).includes(key))
      );
    }
    const admitted = admitMapCatalog(
      mesitaRows,
      [],
      cfg.map,
      cfg.params.popularity,
    ).listed;
    const listed = mergeNearbyCatalog(
      admitted,
      [],
      { lat, lng },
      { mesitaCount: Math.min(CATALOG_NEARBY_HARD_MAX, limit), googleCount: 0 },
      nearbyRadiusKm,
    )
      .slice(0, limit)
      .flatMap((item) => item.kind === "listed" ? [item.row] : [])
      .map((row) => ({
        ...row,
        distance_km: roundedKm(lat, lng, row.lat, row.lng),
      }));
    return json({
      ok: true,
      places: withFamilyKeysList(listed),
      mode: "nearby",
      reloadMinKm: cfg.map.reloadMinKm,
      reloadMinSec: cfg.map.reloadMinSec,
    });
  }

  const places = withFamilyKeysList((data ?? []) as unknown as CardRow[]);
  return json({ ok: true, places });
});
