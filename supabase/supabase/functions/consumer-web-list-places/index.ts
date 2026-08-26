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
  NEARBY_SCAN_LIMIT,
  sortByDistance,
} from "../_shared/geo.ts";
import {
  readGooglePlacesKey,
  searchNearbyPlaces,
  type NearbyGoogleHit,
} from "../_shared/google-places.ts";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const SEARCH_NEARBY_TINY = 10;
const NEARBY_COLUMNS = `${PLACE_CARD_COLUMNS}, google_place_id`;

type ListBody = {
  limit?: number;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  south?: number;
  west?: number;
  north?: number;
  east?: number;
};

type CardRow = {
  id?: string;
  name?: string | null;
  google_name?: string | null;
  category?: string | null;
  google_place_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  [key: string]: unknown;
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
  // Operator maxDistanceKm is Swipe's radius — never pass guest geo into
  // applyDiscoveryFilters here. Nearby uses its own large radius + distance
  // order. Viewport bbox remains a camera rectangle for non-Search callers.
  const efEnv = readEFEnv();
  const filters = efEnv.ok
    ? (await loadDiscoveryConfig(adminClient(efEnv.env))).filters
    : DISCOVERY_DEFAULTS.filters;

  // MESITA-1283: list returns MANY places per request — the card projection
  // (every public column except the five enrichment-filled jsonb ones), not
  // the full single-place read. Nothing here reads those five; verified
  // against discovery-filters.ts and this file before wiring.
  const wantCount = bboxDecision.mode === "ok";
  const scanLimit = nearbyDecision.mode === "ok" ? NEARBY_SCAN_LIMIT : limit;
  const base = supabase
    .from("profiles")
    .select(PLACE_CARD_COLUMNS, wantCount ? { count: "exact" } : undefined);

  let filtered = applyDiscoveryFilters(base, filters, {
    lat: null,
    lng: null,
  });
  if (nearbyDecision.mode === "ok") {
    filtered = applyBboxPredicate(
      filtered,
      nearbyBbox(nearbyDecision.lat, nearbyDecision.lng, nearbyDecision.radiusKm),
    );
  } else if (bboxDecision.mode === "ok") {
    filtered = applyBboxPredicate(filtered, bboxDecision.bbox);
  }

  const { data, error, count } = await filtered
    .order("created_at", { ascending: false })
    .limit(scanLimit);

  if (error) {
    return json({ ok: false, error: error.message }, 500);
  }

  // `name` arrives already resolved — it is a generated column
  // (mesita_name → google_name), so there is nothing to coalesce here.
  let rows = (data ?? []) as unknown as CardRow[];
  if (nearbyDecision.mode === "ok") {
    const { lat, lng, radiusKm } = nearbyDecision;
    rows = sortByDistance(rows, lat, lng)
      .filter((row) => haversineKm(lat, lng, row.lat ?? null, row.lng ?? null) <= radiusKm)
      .slice(0, limit)
      .map((row) => ({
        ...row,
        distance_km: Math.round(
          haversineKm(lat, lng, row.lat ?? null, row.lng ?? null) * 10,
        ) / 10,
      }));
    if (rows.length < SEARCH_NEARBY_TINY) {
      rows = await fillFromGoogleNearby(
        supabase,
        { lat, lng, radiusKm },
        rows,
        filters,
        limit,
      );
    }
  }
  const places = withFamilyKeysList(rows);
  if (nearbyDecision.mode === "ok") {
    return json({ ok: true, places, mode: "nearby" });
  }
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

async function fillFromGoogleNearby(
  supabase: ReturnType<typeof anonClient>,
  origin: { lat: number; lng: number; radiusKm: number },
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
    Math.min(50_000, origin.radiusKm * 1000),
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
  const listedByGid = new Set(
    listed
      .map((row) => row.google_place_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  );

  const seenIds = new Set(mesita.map((row) => row.id).filter(Boolean));
  const merged: CardRow[] = [...mesita];
  for (const row of listed) {
    if (row.id && !seenIds.has(row.id)) {
      seenIds.add(row.id);
      merged.push(row);
    }
  }

  const nearestMesita = sortByDistance(merged, origin.lat, origin.lng)
    .filter((row) =>
      haversineKm(origin.lat, origin.lng, row.lat ?? null, row.lng ?? null) <=
        origin.radiusKm
    )
    .slice(0, limit);
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
