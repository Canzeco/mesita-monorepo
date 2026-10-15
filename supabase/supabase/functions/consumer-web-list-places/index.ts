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
//   { lat, lng, limit? } — listed nearby (mobile Search). Closest N of
//     the Mesita Places set. No Google stubs — mobile opens `/place/:id`
//     and cannot host GooglePlaceSheet.
//   { google: true, lat, lng } — web
//     Search catalog. THREE NESTED SETS (MESITA-2158):
//       Google Places ⊃ Mesita Places ⊃ Mesita Enriched Places
//       gray            ink             red
//     `placesScope` names the set — "enriched" | "mesita" | "google".
//     Mesita Places is every listed row whose profile is ready, Created
//     ones included; enrichment (`enriched_at` set, MESITA-2154) gates
//     only the inner ring (`admitsScopeRow`). A Google hit Mesita owns is
//     never a stub: a Created row a cut left out paints it, and an
//     Enriched row the ring cuts left out drops it (`claimOwnedHits`).
//
//     WEB SEARCH POSTS scope + familyKeys + minReviews (MESITA-1790).
//     How many stays operator `map.pinCount`. `map.googleFill` still
//     decides whether Nearby may be billed. Guest Super pills outrank
//     `map.supers` for Nearby batteries. Popularity (`minReviews`) is a
//     Discovery-mode cut after the catalog is assembled — not a Nearby
//     API param. A `google: true` call with no scope still resolves to the
//     GOOGLE ring so a silent older client keeps its operator-widest
//     default; a live Filters sheet always names the ring.
//
//     A call WITHOUT `google: true` keeps the old default: absent or
//     unknown resolves to "mesita", the widest Mesita ring (wider since
//     MESITA-2158: Created places too). Mobile Search
//     and the web Pay picker post no scope and must not be narrowed, and
//     the Pay picker names its scope outright besides.
//
//     Legacy numerics keep their old meanings (1 = Mesita, 2/3 = Google).
//     A client `limit` still wins when one is sent; familyKeys still pick
//     Nearby `includedPrimaryTypes` from GOOGLE_SEARCH_TYPES when a caller
//     sends them. Only the Google scope calls Nearby, and
//     every gate on that call reads `lanes.googleCount`, never the scope
//     name — one place to change, no literal to miss. Google set stays
//     distance. Listed set Lineup-reorders (Map mask). Google fill is
//     metered per connecting IP.
//   { limit? } / GET — Pay / Home: global newest-first.
//
// Local:  supabase functions serve consumer-web-list-places
// Deploy: supabase functions deploy consumer-web-list-places

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { clampIntRange, corsPreflight, json, rejectUnlessMethods, readJsonOr } from "../_shared/http.ts";
import { adminClient, anonClient, readAnonEnv, readEFEnv } from "../_shared/auth.ts";
import { PLACE_CARD_COLUMNS } from "../_shared/place-columns.ts";
import { withFamilyKeysList } from "../_shared/place-family-keys.ts";
import { googleCategoryDisplay } from "../_shared/google-categories.ts";
import {
  loadDiscoveryConfig,
} from "../_shared/discovery-config.ts";
import { DISCOVERY_DEFAULTS } from "../_shared/discovery-config.ts";
import { applyDiscoveryFilters } from "../_shared/discovery-filters.ts";
import { attachCrenupHighWater } from "../_shared/discovery-place.ts";
import {
  applyGeneralGateQuery,
  clearsGeneralGate,
} from "../_shared/discovery-general-gate.ts";
import {
  admitGuestMinReviews,
  admitMapCatalog,
  enabledNearbyTypes,
  listedMapFilters,
  mapShouldFillGoogle,
  parseMapMinReviews,
} from "../_shared/map-engine.ts";
import {
  applyBboxPredicate,
  decideNearby,
  haversineKm,
  nearbyBbox,
  NEARBY_RADIUS_KM,
  NEARBY_SCAN_LIMIT,
  wantsGoogleFill,
} from "../_shared/geo.ts";
import {
  admitsScopeRow,
  claimOwnedHits,
  lanesForPlacesScope,
  mergeNearbyCatalog,
  parsePlacesScope,
  peekCachedNearbyPlaces,
  PLACES_SCOPE_DEFAULT,
  resolveGoogleItem,
  searchNearbyPlaces,
  type NearbyHit,
  type PlacesScope,
} from "../_shared/nearby-places.ts";
import {
  mapLineupIntent,
  mapLineupWeights,
  reorderListedLanes,
} from "../_shared/nearby-lineup.ts";
import { consumeNearbyGoogleQuota } from "../_shared/nearby-google-quota.ts";
import { hashConnectingIp } from "../_shared/connecting-ip.ts";
import { readGooglePlacesKey } from "../_shared/google-places.ts";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function googleStub(hit: NearbyHit, distanceKm: number | null): Record<string, unknown> {
  return {
    id: `g:${hit.placeId}`,
    slug: hit.placeId,
    google_place_id: hit.placeId,
    name: hit.name,
    category: hit.primaryType,
    category_label: googleCategoryDisplay(hit.primaryType),
    price_level: null,
    currency: "MXN",
    state: "active",
    lat: hit.lat,
    lng: hit.lng,
    address: hit.address || null,
    timezone: null,
    closes_at: null,
    hours: null,
    phone: null,
    pitch: null,
    story: null,
    description: null,
    photos: [],
    website_url: null,
    instagram_url: null,
    facebook_url: null,
    whatsapp_url: null,
    opentable_url: null,
    resy_url: null,
    uber_eats_url: null,
    x_url: null,
    threads_url: null,
    reddit_url: null,
    didi_food_url: null,
    google_maps_url: null,
    created_at: new Date(0).toISOString(),
    google_stars_overall: hit.rating,
    google_rating: hit.rating,
    google_review_count: hit.reviewCount,
    google_count: hit.reviewCount,
    zone: null,
    city: null,
    // Not a Mesita place, so never enriched: no `enriched_at`, and
    // `googleOnly` excludes it from the Enriched signal by name.
    content_state: "ready",
    enriched_at: null,
    googleOnly: true,
    from_google: true,
    distance_km: distanceKm,
  };
}

function stripGooglePlaceId<T extends { google_place_id?: unknown }>(
  row: T,
): Omit<T, "google_place_id"> {
  const { google_place_id: _gid, ...rest } = row;
  return rest;
}

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
  let guestMinReviews = 0;
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
    guestMinReviews = parseMapMinReviews(body.minReviews);
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
  // (`discovery_config.map`). Swipe's maxDistanceKm is never applied here —
  // Nearby uses its own large radius + closest N of the selected Places
  // set. Pay / Home GET callers keep global filters only. Google
  // fill is client opt-in AND operator googleFill AND at least one Super on.
  // HOW MANY PINS is `map.pinCount`; HOW MANY GOOGLE ROWS WE BUY is
  // `map.googlePull` (MESITA-1695). Two questions, two knobs. Guest
  // Popularity (`minReviews`) is a Discovery-mode floor on top, never a
  // Nearby API param.
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
  // Places have no family, so Nearby uses the operator's type batteries.
  const nearbyTypes = enabledNearbyTypes(cfg.map);
  const googleFill = mapShouldFillGoogle(clientGoogle, cfg.map) &&
    nearbyTypes.length > 0;
  // Only the inner ring runs the Enriched gate; the two wider rings admit
  // Created rows and are cut to a ready profile instead (`readyOnMap`).
  const filters = isNearby
    ? listedMapFilters(cfg.filters, cfg.map, placesScope)
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
  const selectCols = googleFill
    ? `${PLACE_CARD_COLUMNS}, google_place_id`
    : PLACE_CARD_COLUMNS;
  const scanLimit = isNearby ? NEARBY_SCAN_LIMIT : limit;
  const nearbyRadiusKm = nearbyDecision.mode === "ok"
    ? (clientGoogle ? NEARBY_RADIUS_KM : nearbyDecision.radiusKm)
    : NEARBY_RADIUS_KM;
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
  // Guest Popularity: same SQL gte the General gate uses, so a capped
  // pool is not thinned after the fact. Unknown (null) does not clear.
  if (isNearby && guestMinReviews > 0) {
    filtered = filtered.gte("google_review_count", guestMinReviews);
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

  if (nearbyDecision.mode === "ok") {
    const { lat, lng } = nearbyDecision;
    const center = { lat, lng };
    const scanRows = (data ?? []) as unknown as CardRow[];
    const lanes = lanesForPlacesScope(placesScope, limit, cfg.map.googlePull);
    let mesitaRows = scanRows.filter((row) => admitsScopeRow(placesScope, row));

    if (!googleFill) {
      const admitted = admitGuestMinReviews(
        admitMapCatalog(mesitaRows, [], cfg.map, cfg.params.popularity).listed,
        [],
        guestMinReviews,
      );
      const inRadius = admitted.listed.filter((row) =>
        haversineKm(lat, lng, row.lat ?? null, row.lng ?? null) <= nearbyRadiusKm
      );
      const listed = mergeNearbyCatalog(
        inRadius,
        [],
        center,
        lanes,
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

    let googleHits: NearbyHit[] = [];
    // Gate on the CAP, never on the scope name: the cap is one value that
    // every branch below reuses, so there is no second literal to forget.
    const wantGoogleNearby = lanes.googleCount > 0;
    const gmp = readGooglePlacesKey();
    if (wantGoogleNearby && gmp.ok) {
      const cached = peekCachedNearbyPlaces(center, nearbyTypes, cfg.map.googlePull);
      if (cached) {
        googleHits = cached;
      } else if (efEnv.ok) {
        // Shared connecting-IP ledger only when THIS isolate is about to
        // fire the one Nearby Search. In-flight same-cell joins and
        // isolate budget skips must not mint a row. Identity is
        // CF-Connecting-IP / rightmost XFF, not the spoofable leftmost hop.
        const ipHash = await hashConnectingIp(req, efEnv.env.serviceKey);
        googleHits = await searchNearbyPlaces(gmp.key, center, {
          types: nearbyTypes,
          // 20 is one request; 40 and 60 are 2 and 3, split by battery.
          pull: cfg.map.googlePull,
          beforeFanout: () =>
            consumeNearbyGoogleQuota(adminClient(efEnv.env), ipHash).then(
              (quota) => quota.allow,
            ),
        });
      }
    }
    const haveGid = new Set(
      mesitaRows.map((row) => row.google_place_id).filter((id): id is string =>
        Boolean(id)
      ),
    );
    const missing = [
      ...new Set(
        googleHits.map((hit) => hit.placeId).filter((id) => !haveGid.has(id)),
      ),
    ];
    // Which of these hits does Mesita already own? ONE unfiltered lookup by
    // google_place_id (RLS limits it to listed rows). It must not carry the
    // ring cuts: a Created place that fails the General gate, a Map floor,
    // the guest's Popularity or the Super overlap on stored family_keys
    // (door synthesis can leave `['undefined']`) would fall through to a
    // stub whose "Add to Mesita" 409s `place_already_exists`. MESITA-2154.
    let ownedRows: CardRow[] = [];
    if (missing.length > 0) {
      const owned = await (supabase.from("profiles").select(selectCols) as unknown as {
        in: (
          col: string,
          vals: string[],
        ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
      }).in("google_place_id", missing);
      if (owned.error) {
        console.error("[consumer-web-list-places] owned gid lookup:", owned.error.message);
      } else {
        ownedRows = (owned.data ?? []) as CardRow[];
      }
    }
    // Ring admission keeps every cut: only an owned row the scope admits can
    // join, and only if the filtered query (bbox aside) still returns it.
    // Skipped when no owned row is in the scope, so the common case stays
    // one query.
    const ringOwnedGids = [
      ...new Set(
        ownedRows
          .filter((row) => admitsScopeRow(placesScope, row))
          .map((row) => row.google_place_id?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (ringOwnedGids.length > 0) {
      const extraSelect = supabase.from("profiles").select(selectCols);
      let extraFiltered = readyOnMap(applyGeneralGateQuery(
        applyDiscoveryFilters(extraSelect, filters, { lat: null, lng: null }),
        cfg.general,
      ));
      if (guestMinReviews > 0) {
        extraFiltered = extraFiltered.gte(
          "google_review_count",
          guestMinReviews,
        );
      }
      const extra = await (extraFiltered as unknown as {
        in: (
          col: string,
          vals: string[],
        ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
      }).in("google_place_id", ringOwnedGids);
      if (!extra.error && extra.data) {
        const seen = new Set(mesitaRows.map((row) => row.id));
        for (const row of extra.data as CardRow[]) {
          if (seen.has(row.id)) continue;
          if (!admitsScopeRow(placesScope, row)) continue;
          seen.add(row.id);
          mesitaRows = [...mesitaRows, row];
        }
      }
    }
    // A Created row the cuts left out paints its hit; an Enriched row the
    // cuts left out drops its hit. Either way no owned gid becomes a stub.
    const claim = claimOwnedHits(googleHits, ownedRows, mesitaRows);
    // The Google side of the same gate. Nearby now carries businessStatus +
    // userRatingCount on its field mask, so the wipe is provable here rather
    // than deferred to a Details call the map lane never makes.
    const mapped = admitMapCatalog(
      mesitaRows,
      claim.hits.filter((hit) => clearsGeneralGate(cfg.general, hit)),
      cfg.map,
      cfg.params.popularity,
    );
    const admitted = admitGuestMinReviews(
      mapped.listed,
      mapped.google,
      guestMinReviews,
    );
    const googleForMerge = wantGoogleNearby ? admitted.google : [];
    // The `enriched` signal's gradient (MESITA-1598, kept at MESITA-1858)
    // needs `crenup_high_water` on the row, and `profiles` doesn't carry it.
    // One batched side-read merges it in before ranking, same pattern as
    // consumer-web-recommend-swipe. WITHOUT THIS every enriched row scores
    // the same 1 — on the inner ring `admitsScopeRow` admitted only those.
    // Skipped when the Google-fill branch below keeps distance order instead.
    const willReorder = !(wantGoogleNearby && googleForMerge.length > 0);
    const listedForCatalog = willReorder && efEnv.ok
      ? await attachCrenupHighWater(
        adminClient(efEnv.env),
        admitted.listed as unknown as Record<string, unknown>[],
      ) as unknown as typeof admitted.listed
      : admitted.listed;
    const catalog = mergeNearbyCatalog(
      listedForCatalog,
      googleForMerge,
      center,
      lanes,
    );
    const lineupOpts = {
      center,
      weights: mapLineupWeights(cfg),
      params: cfg.params,
      ...mapLineupIntent(nearbyTypes),
    };
    // Google set stays nearest-N distance. Lineup only reorders the Mesita
    // ring, including the empty-Nearby fallback.
    const merged = (
      wantGoogleNearby && googleForMerge.length > 0
        ? catalog
        : reorderListedLanes(catalog, lineupOpts)
    ).slice(0, limit);
    const places = withFamilyKeysList(
      merged.flatMap((item) => {
        if (item.kind === "listed") {
          const row = stripGooglePlaceId(item.row);
          return [{
            ...row,
            distance_km: roundedKm(lat, lng, row.lat, row.lng),
          }];
        }
        // Never a stub for a gid Mesita owns (claimOwnedHits above).
        const out = resolveGoogleItem(item.hit, claim);
        if (out.kind === "drop") return [];
        if (out.kind === "mesita") {
          const row = stripGooglePlaceId(out.row);
          return [{
            ...row,
            distance_km: roundedKm(lat, lng, row.lat, row.lng),
          }];
        }
        return [googleStub(
          item.hit,
          roundedKm(lat, lng, item.hit.lat, item.hit.lng),
        )];
      }) as Array<{
        name?: string | null;
        google_name?: string | null;
        category?: string | null;
      }>,
    );
    // One line, because every failure mode of the Places scope is a WRONG
    // SET rather than an error: a scope-skewed client, an operator who
    // switched Google off, and a spent IP quota all look identical to a
    // thin catalog from the outside. `googleFillOn` and `quotaAllowed`
    // separate "the guest asked for Google and we chose not to" from "the
    // guest asked for Google and there was none" three weeks after ship.
    console.log(JSON.stringify({
      fn: "consumer-web-list-places",
      mode: "nearby",
      scope: placesScope,
      googleFillOn: googleFill,
      quotaAllowed: wantGoogleNearby ? googleHits.length > 0 : null,
      mesitaRows: mesitaRows.length,
      googleHits: googleHits.length,
      returned: places.length,
      limit,
    }));
    return json({
      ok: true,
      places,
      mode: "nearby",
      reloadMinKm: cfg.map.reloadMinKm,
      reloadMinSec: cfg.map.reloadMinSec,
    });
  }

  const places = withFamilyKeysList((data ?? []) as unknown as CardRow[]);
  return json({ ok: true, places });
});
