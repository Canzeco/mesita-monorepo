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
//   { nearby: true, lat, lng, limit? } — Search map catalog. Closest 50 in a
//     50 km circle: listed Mesita ∪ Google Nearby Search (New). Distance
//     order from the camera / guest pin. Google-only rows are stubs.
//   { south, west, north, east, limit? } — listed pins inside the camera
//     rectangle (kept for callers that still send a box).
//   { limit? } / GET — Pay / Home / mobile: global newest-first.
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
  circleBbox,
  decideBbox,
  decideNearby,
  NEARBY_RADIUS_KM,
} from "../_shared/geo.ts";
import {
  CATALOG_NEARBY_MAX,
  MESITA_NEARBY_POOL,
  mergeNearbyCatalog,
  searchNearbyPlaces,
  type NearbyHit,
} from "../_shared/nearby-places.ts";
import { readGooglePlacesKey } from "../_shared/google-places.ts";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function googleStub(hit: NearbyHit): Record<string, unknown> {
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
  };
}

function stripGooglePlaceId<T extends { google_place_id?: unknown }>(
  row: T,
): Omit<T, "google_place_id"> {
  const { google_place_id: _gid, ...rest } = row;
  return rest;
}

type ListBody = {
  limit?: number;
  nearby?: boolean;
  lat?: number;
  lng?: number;
  south?: number;
  west?: number;
  north?: number;
  east?: number;
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
  // Nearby + viewport bbox are POST-only. GET ignores geo so Pay / Home /
  // mobile no-geo callers stay on today's global newest-first path.
  let limit = DEFAULT_LIMIT;
  let nearbyDecision: ReturnType<typeof decideNearby> = { mode: "none" };
  let bboxDecision: ReturnType<typeof decideBbox> = { mode: "none" };
  if (req.method === "POST") {
    const body = await readJsonOr<ListBody>(req, {});
    if (typeof body.limit === "number") {
      limit = clampIntRange(body.limit, 1, MAX_LIMIT);
    }
    nearbyDecision = decideNearby(body as Record<string, unknown>);
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
  // Operator maxDistanceKm is Swipe's radius. Map never sends guest geo
  // here, so that filter stays off. Nearby Search is a different question:
  // the closest 50 around the camera (50 km circle + Google fill). Viewport
  // bbox remains listed-in-rectangle for leftover box callers.
  const efEnv = readEFEnv();
  const filters = efEnv.ok
    ? (await loadDiscoveryConfig(adminClient(efEnv.env))).filters
    : DISCOVERY_DEFAULTS.filters;

  const isNearby = nearbyDecision.mode === "ok";
  const isBbox = !isNearby && bboxDecision.mode === "ok";
  const wantCount = isBbox;
  const selectCols = isNearby
    ? `${PLACE_CARD_COLUMNS}, google_place_id`
    : PLACE_CARD_COLUMNS;
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
      circleBbox(nearbyDecision.center, NEARBY_RADIUS_KM),
    );
  } else if (bboxDecision.mode === "ok") {
    filtered = applyBboxPredicate(filtered, bboxDecision.bbox);
  }

  let data: unknown[] | null = null;
  let error: { message: string } | null = null;
  let count: number | null = null;

  if (isNearby) {
    // Distance rank happens in mergeNearbyCatalog. Newest-first would drop
    // an old listed place inside the 50 km box and let Google paint it as
    // a yellow stub.
    const nearby = await filtered.limit(MESITA_NEARBY_POOL);
    data = nearby.data;
    error = nearby.error;
  } else {
    const page = await filtered
      .order("created_at", { ascending: false })
      .limit(limit);
    data = page.data;
    error = page.error;
    count = page.count ?? null;
  }

  if (error) {
    return json({ ok: false, error: error.message }, 500);
  }

  if (nearbyDecision.mode === "ok") {
    const center = nearbyDecision.center;
    const mesitaRows = (data ?? []) as Array<{
      id: string;
      google_place_id?: string | null;
      lat?: number | null;
      lng?: number | null;
      name?: string | null;
      google_name?: string | null;
      category?: string | null;
    }>;
    let googleHits: NearbyHit[] = [];
    const gmp = readGooglePlacesKey();
    if (gmp.ok) {
      googleHits = await searchNearbyPlaces(gmp.key, center);
    }
    const cap = Math.min(limit, CATALOG_NEARBY_MAX);
    const merged = mergeNearbyCatalog(mesitaRows, googleHits, center, cap);
    const places = withFamilyKeysList(
      merged.map((item) =>
        item.kind === "listed"
          ? stripGooglePlaceId(item.row)
          : googleStub(item.hit)
      ) as Array<{
        name?: string | null;
        google_name?: string | null;
        category?: string | null;
      }>,
    );
    return json({
      ok: true,
      places,
      overspan: false,
      totalInBox: places.length,
    });
  }

  const places = withFamilyKeysList(
    (data ?? []) as Array<{
      name?: string | null;
      google_name?: string | null;
      category?: string | null;
    }>,
  );
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
