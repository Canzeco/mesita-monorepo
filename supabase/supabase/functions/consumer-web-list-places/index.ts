// Supabase Edge Function — consumer-web-list-places
//
// The MAP engine's pool. Public endpoint: returns places visible to consumers
// (status in 'active', 'lead'). Self-contained: no calls to other functions.
//
// THREE CLIENTS, ON PURPOSE.
//   GET / omitted geo / omitted nearby → newest-first (Pay, Home, mobile
//   no-bbox). POST bbox → listed pins in a camera rectangle (overspan-empty
//   past 0.75°). POST { nearby: true, lat, lng } → Search map: nearest 50
//   in a large radius, distance order. Nearby never uses the viewport clamp.
//
// TWO SUPABASE CLIENTS (MESITA-1276). The PLACES query stays on the ANON
// client because RLS is the single source of truth for what a consumer may
// see. The CONFIG read uses an admin client because `app_config` is EF-only.
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
import { applyBboxPredicate, decideBbox } from "../_shared/geo.ts";
import {
  decideNearby,
  nearestByDistance,
  nearbyBox,
  SEARCH_NEARBY_FETCH,
  SEARCH_NEARBY_TINY,
  type NearbyOrigin,
} from "../_shared/list-places-nearby.ts";
import {
  readGooglePlacesKey,
  searchNearbyPlaces,
  type NearbyGoogleHit,
} from "../_shared/google-places.ts";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const NEARBY_COLUMNS = `${PLACE_CARD_COLUMNS}, google_place_id`;

type CardRow = {
  id?: string;
  name?: string | null;
  google_name?: string | null;
  category?: string | null;
  google_place_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  [key: string]: unknown;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const _methodGuard = rejectUnlessMethods(req, "GET", "POST");
  if (_methodGuard) return _methodGuard;

  const envRes = readAnonEnv();
  if (!envRes.ok) return envRes.response;

  const supabase = anonClient(envRes.env);

  let limit = DEFAULT_LIMIT;
  let bboxDecision: ReturnType<typeof decideBbox> = { mode: "none" };
  let nearbyDecision: ReturnType<typeof decideNearby> = { mode: "none" };
  if (req.method === "POST") {
    const body = await readJsonOr<Record<string, unknown>>(req, {});
    if (typeof body.limit === "number") {
      limit = clampIntRange(body.limit, 1, MAX_LIMIT);
    }
    nearbyDecision = decideNearby(body);
    // Nearby is Search's pool. A leftover bbox on the same body must not
    // overspan-empty the nearest-50 path.
    if (nearbyDecision.mode === "none") {
      bboxDecision = decideBbox(body);
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

  const efEnv = readEFEnv();
  const filters = efEnv.ok
    ? (await loadDiscoveryConfig(adminClient(efEnv.env))).filters
    : DISCOVERY_DEFAULTS.filters;

  if (nearbyDecision.mode === "ok") {
    return nearbyResponse(supabase, nearbyDecision.origin, limit, filters);
  }

  const wantCount = bboxDecision.mode === "ok";
  const base = supabase
    .from("profiles")
    .select(PLACE_CARD_COLUMNS, wantCount ? { count: "exact" } : undefined);

  let filtered = applyDiscoveryFilters(base, filters, {
    lat: null,
    lng: null,
  });
  if (bboxDecision.mode === "ok") {
    filtered = applyBboxPredicate(filtered, bboxDecision.bbox);
  }

  const { data, error, count } = await filtered
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return json({ ok: false, error: error.message }, 500);
  }

  const places = withFamilyKeysList(
    (data ?? []) as Array<{
      name?: string | null;
      google_name?: string | null;
      category?: string | null;
    }>,
  );
  if (bboxDecision.mode === "ok") {
    return json({
      ok: true,
      places,
      overspan: false,
      totalInBox: typeof count === "number" ? count : places.length,
    });
  }
  return json({ ok: true, places });
});

async function nearbyResponse(
  supabase: ReturnType<typeof anonClient>,
  origin: NearbyOrigin,
  limit: number,
  filters: typeof DISCOVERY_DEFAULTS.filters,
): Promise<Response> {
  const box = nearbyBox(origin);
  const base = supabase.from("profiles").select(NEARBY_COLUMNS);
  let filtered = applyDiscoveryFilters(base, filters, {
    lat: null,
    lng: null,
  });
  filtered = applyBboxPredicate(filtered, box);

  const { data, error } = await filtered
    .order("created_at", { ascending: false })
    .limit(SEARCH_NEARBY_FETCH);

  if (error) {
    return json({ ok: false, error: error.message }, 500);
  }

  const mesita = nearestByDistance(
    (data ?? []) as unknown as CardRow[],
    origin,
    (row) => (typeof row.lat === "number" ? row.lat : null),
    (row) => (typeof row.lng === "number" ? row.lng : null),
    limit,
  );

  let rows: CardRow[] = mesita;
  if (mesita.length < SEARCH_NEARBY_TINY) {
    rows = await fillFromGoogleNearby(supabase, origin, mesita, filters, limit);
  }

  return json({
    ok: true,
    places: withFamilyKeysList(rows),
    nearby: true,
  });
}

async function fillFromGoogleNearby(
  supabase: ReturnType<typeof anonClient>,
  origin: NearbyOrigin,
  mesita: CardRow[],
  filters: typeof DISCOVERY_DEFAULTS.filters,
  limit: number,
): Promise<CardRow[]> {
  const key = readGooglePlacesKey();
  if (!key.ok) return mesita;

  const hits = await searchNearbyPlaces(
    key.key,
    origin.lat,
    origin.lng,
    origin.radiusKm * 1000,
    20,
  );
  if (hits.length === 0) return mesita;

  const ids = hits.map((h) => h.placeId);
  const { data } = await applyDiscoveryFilters(
    supabase.from("profiles").select(NEARBY_COLUMNS).in("google_place_id", ids),
    filters,
    { lat: null, lng: null },
  );
  const listed = (data ?? []) as unknown as CardRow[];
  const listedByGid = new Map(
    listed
      .filter((row) => typeof row.google_place_id === "string")
      .map((row) => [row.google_place_id as string, row]),
  );

  const seenIds = new Set(mesita.map((row) => row.id).filter(Boolean));
  const merged: CardRow[] = [...mesita];
  for (const row of listed) {
    if (row.id && !seenIds.has(row.id)) {
      seenIds.add(row.id);
      merged.push(row);
    }
  }

  const nearestMesita = nearestByDistance(
    merged,
    origin,
    (row) => (typeof row.lat === "number" ? row.lat : null),
    (row) => (typeof row.lng === "number" ? row.lng : null),
    limit,
  );
  if (nearestMesita.length >= limit) return nearestMesita;

  const usedGids = new Set(
    nearestMesita
      .map((row) => row.google_place_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  );
  const stubs = hits
    .filter((hit) => !usedGids.has(hit.placeId) && !listedByGid.has(hit.placeId))
    .map(googleNearbyStub);

  return [...nearestMesita, ...stubs].slice(0, limit);
}

function googleNearbyStub(hit: NearbyGoogleHit): CardRow {
  const id = `g:${hit.placeId}`;
  return {
    id,
    slug: id,
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
    address: hit.address,
    photos: [],
    partner: false,
    from_google: true,
    google_place_id: hit.placeId,
    created_at: new Date(0).toISOString(),
  };
}
