// Supabase Edge Function — consumer-web-list-places
//
// The MAP engine's pool. Public endpoint: returns places visible to consumers
// (status in 'active', 'lead'). Self-contained: no calls to other functions.
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
// THREE POST SHAPES:
//   { lat, lng, limit? } — listed nearby (mobile Search). Closest 50 in a
//     large radius. No Google stubs — mobile opens `/place/:id` and cannot
//     host GooglePlaceSheet.
//   { google: true, lat, lng, limit? } — web Search catalog. Listed Mesita
//     in 50 km ∪ Google Nearby Search (New). Distance order. Google-only
//     rows are stubs. Missing listed Place IDs are fetched by google_place_id
//     so a close Mesita row outside the 1000 scan does not become a stub.
//     Google fill is metered per connecting IP (CF-Connecting-IP / rightmost
//     XFF, 45/60s) plus a 600/60s global cap, before the five Nearby calls.
//     Over quota skips Google, not the catalog.
//   { south, west, north, east, limit? } — listed pins inside a camera
//     rectangle (kept for callers that still send a box).
//   { limit? } / GET — Pay / Home: global newest-first.
//
// Local:  supabase functions serve consumer-web-list-places
// Deploy: supabase functions deploy consumer-web-list-places

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { clampIntRange, corsPreflight, json, rejectUnlessMethods, readJsonOr } from "../_shared/http.ts";
import { adminClient, anonClient, readAnonEnv, readEFEnv } from "../_shared/auth.ts";
import { PLACE_CARD_COLUMNS } from "../_shared/place-columns.ts";
import { withFamilyKeysList } from "../_shared/place-family-keys.ts";
import { loadDiscoveryConfig } from "../_shared/discovery-config.ts";
import { DISCOVERY_DEFAULTS } from "../_shared/discovery-config.ts";
import { applyDiscoveryFilters } from "../_shared/discovery-filters.ts";
import {
  applyBboxPredicate,
  decideBbox,
  decideNearby,
  haversineKm,
  nearbyBbox,
  NEARBY_RADIUS_KM,
  NEARBY_SCAN_LIMIT,
  sortByDistance,
  wantsGoogleFill,
} from "../_shared/geo.ts";
import {
  CATALOG_NEARBY_MAX,
  mergeNearbyCatalog,
  peekCachedNearbyPlaces,
  searchNearbyPlaces,
  type NearbyHit,
} from "../_shared/nearby-places.ts";
import { consumeNearbyGoogleQuota } from "../_shared/nearby-google-quota.ts";
import { hashConnectingIp } from "../_shared/connecting-ip.ts";
import { readGooglePlacesKey } from "../_shared/google-places.ts";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function googleStub(hit: NearbyHit, distanceKm: number | null): Record<string, unknown> {
  return {
    id: `g:${hit.placeId}`,
    slug: hit.placeId,
    name: hit.name,
    category: hit.primaryType,
    category_label: null,
    vibe: null,
    price_level: null,
    currency: "MXN",
    listing_type: "web",
    status: "lead",
    fiscal_type: "informal",
    plan: "free",
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
    email: null,
    created_at: new Date(0).toISOString(),
    google_stars_overall: hit.rating,
    google_rating: hit.rating,
    google_review_count: null,
    zone: null,
    city: null,
    content_status: "ready",
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
  lat?: number;
  lng?: number;
  radiusKm?: number;
  south?: number;
  west?: number;
  north?: number;
  east?: number;
};

type CardRow = {
  id: string;
  google_place_id?: string | null;
  name?: string | null;
  google_name?: string | null;
  category?: string | null;
  lat?: number | null;
  lng?: number | null;
  distance_km?: number | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const _methodGuard = rejectUnlessMethods(req, "GET", "POST");
  if (_methodGuard) return _methodGuard;

  const envRes = readAnonEnv();
  if (!envRes.ok) return envRes.response;

  // Anon client is sufficient: the places RLS policy already restricts SELECT
  // to status in ('active', 'lead') for anon + authenticated. This is the
  // single source of truth for what consumers are allowed to see.
  const supabase = anonClient(envRes.env);

  // Limit can come from a JSON body (POST from supabase.functions.invoke) or
  // a query string (?limit=… for raw GETs). Body wins if both are present.
  // Geo is POST-only. GET / omitted lat+lng (Pay, Home) stay newest-first.
  // Nearby (lat+lng) is Search's pool. Optional bbox stays for other callers
  // but Search does not send it — a tight camera box is how 4 pins shipped.
  let limit = DEFAULT_LIMIT;
  let nearbyDecision: ReturnType<typeof decideNearby> = { mode: "none" };
  let googleFill = false;
  let bboxDecision: ReturnType<typeof decideBbox> = { mode: "none" };
  if (req.method === "POST") {
    const body = await readJsonOr<ListBody>(req, {});
    if (typeof body.limit === "number") {
      limit = clampIntRange(body.limit, 1, MAX_LIMIT);
    }
    nearbyDecision = decideNearby(body as Record<string, unknown>);
    googleFill = nearbyDecision.mode === "ok" &&
      wantsGoogleFill(body as Record<string, unknown>);
    if (nearbyDecision.mode === "none") {
      bboxDecision = decideBbox(body as Record<string, unknown>);
    }
  } else {
    const q = Number(new URL(req.url).searchParams.get("limit"));
    if (Number.isFinite(q)) limit = clampIntRange(q, 1, MAX_LIMIT);
  }

  if (nearbyDecision.mode === "invalid") {
    return json({
      ok: false,
      error: "nearby needs finite lat and lng",
      code: "invalid_nearby",
    }, 400);
  }
  if (bboxDecision.mode === "invalid") {
    return json({
      ok: false,
      error: "bbox needs finite south, west, north, east (south < north)",
      code: "invalid_bbox",
    }, 400);
  }
  if (bboxDecision.mode === "overspan") {
    return json({ ok: true, places: [], overspan: true });
  }

  // Pool admission comes from the Filters box, shared with Swipe. The
  // enrichment gate MESITA-1228 hardcoded here is now `filters.requireReady`,
  // still defaulted ON: Map must not show a place whose pipeline has not
  // landed 'ready', because a half-enriched card has no description, no images
  // and no hours — a broken listing rather than a pending one. Applied as a
  // PREDICATE so `limit` fills with eligible rows instead of being spent on
  // ineligible ones.
  //
  // Operator maxDistanceKm is Swipe's radius — never pass guest geo into
  // applyDiscoveryFilters here. Nearby uses its own large radius + distance
  // order, then Google fill. Viewport bbox remains a camera rectangle for
  // non-Search callers.
  const efEnv = readEFEnv();
  const filters = efEnv.ok
    ? (await loadDiscoveryConfig(adminClient(efEnv.env))).filters
    : DISCOVERY_DEFAULTS.filters;

  // MESITA-1283: list returns MANY places per request — the card projection
  // (every public column except the five enrichment-filled jsonb ones), not
  // the full single-place read. Nothing here reads those five; verified
  // against discovery-filters.ts and this file before wiring.
  const isNearby = nearbyDecision.mode === "ok";
  const isBbox = !isNearby && bboxDecision.mode === "ok";
  const wantCount = isBbox;
  const selectCols = googleFill
    ? `${PLACE_CARD_COLUMNS}, google_place_id`
    : PLACE_CARD_COLUMNS;
  const scanLimit = isNearby ? NEARBY_SCAN_LIMIT : limit;
  const nearbyRadiusKm = nearbyDecision.mode === "ok"
    ? (googleFill ? NEARBY_RADIUS_KM : nearbyDecision.radiusKm)
    : NEARBY_RADIUS_KM;
  const base = supabase
    .from("profiles")
    .select(selectCols, wantCount ? { count: "exact" } : undefined);

  let filtered = applyDiscoveryFilters(base, filters, {
    lat: null,
    lng: null,
  });
  if (nearbyDecision.mode === "ok") {
    filtered = applyBboxPredicate(
      filtered,
      nearbyBbox(nearbyDecision.lat, nearbyDecision.lng, nearbyRadiusKm),
    );
  } else if (bboxDecision.mode === "ok") {
    filtered = applyBboxPredicate(filtered, bboxDecision.bbox);
  }

  // Google-fill must not order by created_at. Newest-N drops an old listed
  // place and lets Google paint it as a yellow stub. Listed-only keeps
  // newest-first then distance-sorts in memory (mobile Search).
  const page = googleFill
    ? await filtered.limit(scanLimit)
    : await filtered.order("created_at", { ascending: false }).limit(scanLimit);
  const { data, error, count } = page;

  if (error) {
    return json({ ok: false, error: error.message }, 500);
  }

  if (nearbyDecision.mode === "ok") {
    const { lat, lng } = nearbyDecision;
    const center = { lat, lng };
    let mesitaRows = (data ?? []) as unknown as CardRow[];

    if (!googleFill) {
      const cap = Math.min(limit, CATALOG_NEARBY_MAX);
      const listed = sortByDistance(mesitaRows, lat, lng)
        .filter((row) =>
          haversineKm(lat, lng, row.lat ?? null, row.lng ?? null) <=
            nearbyRadiusKm
        )
        .slice(0, cap)
        .map((row) => ({
          ...row,
          distance_km: roundedKm(lat, lng, row.lat, row.lng),
        }));
      return json({
        ok: true,
        places: withFamilyKeysList(listed),
        mode: "nearby",
      });
    }

    let googleHits: NearbyHit[] = [];
    const gmp = readGooglePlacesKey();
    if (gmp.ok) {
      const cached = peekCachedNearbyPlaces(center);
      if (cached) {
        googleHits = cached;
      } else if (efEnv.ok) {
        // Shared connecting-IP ledger before any GMP spend. Isolates do not
        // share the in-memory cache/cap; this table does. Identity is
        // CF-Connecting-IP / rightmost XFF, not the spoofable leftmost hop.
        const ipHash = await hashConnectingIp(req, efEnv.env.serviceKey);
        const quota = await consumeNearbyGoogleQuota(
          adminClient(efEnv.env),
          ipHash,
        );
        if (quota.allow) {
          googleHits = await searchNearbyPlaces(gmp.key, center);
        }
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
    if (missing.length > 0) {
      const extraSelect = supabase.from("profiles").select(selectCols);
      const extraFiltered = applyDiscoveryFilters(extraSelect, filters, {
        lat: null,
        lng: null,
      });
      const extra = await (extraFiltered as unknown as {
        in: (
          col: string,
          vals: string[],
        ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
      }).in("google_place_id", missing);
      if (!extra.error && extra.data) {
        const seen = new Set(mesitaRows.map((row) => row.id));
        for (const row of extra.data as CardRow[]) {
          if (!seen.has(row.id)) mesitaRows = [...mesitaRows, row];
        }
      }
    }
    const cap = Math.min(limit, CATALOG_NEARBY_MAX);
    const merged = mergeNearbyCatalog(mesitaRows, googleHits, center, cap);
    const places = withFamilyKeysList(
      merged.map((item) => {
        if (item.kind === "listed") {
          const row = stripGooglePlaceId(item.row);
          return {
            ...row,
            distance_km: roundedKm(lat, lng, row.lat, row.lng),
          };
        }
        return googleStub(
          item.hit,
          roundedKm(lat, lng, item.hit.lat, item.hit.lng),
        );
      }) as Array<{
        name?: string | null;
        google_name?: string | null;
        category?: string | null;
      }>,
    );
    return json({ ok: true, places, mode: "nearby" });
  }

  const places = withFamilyKeysList((data ?? []) as unknown as CardRow[]);
  if (isBbox) {
    return json({
      ok: true,
      places,
      overspan: false,
      totalInBox: typeof count === "number" ? count : places.length,
    });
  }
  return json({ ok: true, places });
});
