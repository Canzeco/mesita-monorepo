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
import { PLACE_PUBLIC_COLUMNS } from "../_shared/place-columns.ts";
import { withFamilyKeysList } from "../_shared/place-family-keys.ts";
import { loadDiscoveryConfig } from "../_shared/discovery-config.ts";
import { DISCOVERY_DEFAULTS } from "../_shared/discovery-config.ts";
import { applyDiscoveryFilters } from "../_shared/discovery-filters.ts";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type ListBody = { limit?: number };

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
  let limit = DEFAULT_LIMIT;
  if (req.method === "POST") {
    const body = await readJsonOr<ListBody>(req, {});
    if (typeof body.limit === "number") {
      limit = clampIntRange(body.limit, 1, MAX_LIMIT);
    }
  } else {
    const q = Number(new URL(req.url).searchParams.get("limit"));
    if (Number.isFinite(q)) limit = clampIntRange(q, 1, MAX_LIMIT);
  }

  // Pool admission comes from the Filters box, shared with Swipe. The
  // enrichment gate MESITA-1228 hardcoded here is now `filters.requireReady`,
  // still defaulted ON: Map must not show a place whose pipeline has not
  // landed 'ready', because a half-enriched card has no description, no images
  // and no hours — a broken listing rather than a pending one. Applied as a
  // PREDICATE so `limit` fills with eligible rows instead of being spent on
  // ineligible ones.
  //
  // Map passes NO geo, so the radius filter never engages here; that one is
  // Swipe's, and applying it to a map the guest is panning would fight the
  // viewport. Every other filter applies to both, which is the point of a
  // shared box — the same admission question deserves one answer.
  const efEnv = readEFEnv();
  const filters = efEnv.ok
    ? (await loadDiscoveryConfig(adminClient(efEnv.env))).filters
    : DISCOVERY_DEFAULTS.filters;

  const base = supabase
    .from("profiles")
    .select(PLACE_PUBLIC_COLUMNS);

  const { data, error } = await applyDiscoveryFilters(base, filters, {
    lat: null,
    lng: null,
  })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return json({ ok: false, error: error.message }, 500);
  }

  // `name` arrives already resolved — it is a generated column
  // (mesita_name → google_name), so there is nothing to coalesce here.
  const places = withFamilyKeysList(
    (data ?? []) as Array<{
      name?: string | null;
      google_name?: string | null;
      category?: string | null;
    }>,
  );
  return json({ ok: true, places });
});
