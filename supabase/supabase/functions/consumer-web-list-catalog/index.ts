// Supabase Edge Function — consumer-web-list-catalog (product caller)
//
// The CATALOG engine — seven guest family lists (Docs › Discovery).
// One round trip: the listed Mesita pool, then one shared ranking profile.
// Family is the list filter. Enriched admits. Name, Description, and
// Selected abstain until a query or a per-entity value exists. No Google.
// Map owns Nearby.
//
// Local:  supabase functions serve consumer-web-list-catalog
// Deploy: supabase functions deploy consumer-web-list-catalog

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { stripInternal } from "../_shared/place-pool-shape.ts";
import type { PlaceProfileRow } from "../_shared/place-pool-shape.ts";
import { PLACE_CARD_COLUMNS } from "../_shared/place-columns.ts";
import { loadDiscoveryConfig } from "../_shared/discovery-config.ts";
import { DISCOVERY_EXTRA_COLUMNS, toLineupPlace } from "../_shared/discovery-place.ts";
import { applyDiscoveryFilters, trimToRadius } from "../_shared/discovery-filters.ts";
import {
  applyDeckPredicates,
  readDeckPredicates,
} from "../_shared/discovery-predicates.ts";
import { rankFamilyLists, type CatalogListPlace } from "../_shared/catalog-rank.ts";

const POOL_CAP = 1000;

type Body = {
  lat?: number;
  lng?: number;
  /**
   * The guest's discovery predicates (MESITA-1697). Feed grew a filter
   * control when it absorbed Catalog's body, and this is where that control
   * lands.
   *
   * IT HAD TO CUT HERE, NOT IN THE BROWSER. Each rail is sliced to
   * `cfg.catalog.placesPerRail` (8) from the pool BEFORE it is returned, so
   * filtering the response client-side leaves 0-2 tiles under a heading that
   * still paints — a filtered catalog that looks broken rather than filtered.
   * Cutting the pool first means every rail that survives is a full rail, and
   * a rail with nothing left is dropped entirely by the existing `continue`.
   *
   * This is the same cut-before-you-rank rule discovery-predicates.ts states
   * and consumer-web-recommend-swipe already follows; Catalog was simply the
   * one engine that had no way to express it. Omitting the field keeps the
   * operator pool exactly as before.
   */
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

  const base = admin
    .from("profiles")
    .select(`${PLACE_CARD_COLUMNS}, ${DISCOVERY_EXTRA_COLUMNS}`)
    .eq("state", "active");

  const { data, error } = await applyDiscoveryFilters(base, cfg.filters, geo)
    .limit(POOL_CAP);

  if (error) {
    console.error("[list-catalog] pool:", error.message);
    return json({ ok: false, error: error.message }, 502);
  }

  const admitted = (data ?? []) as unknown as PlaceProfileRow[];
  const withinRadius = trimToRadius(
    admitted,
    (r) => (r as unknown as Record<string, unknown>).lat as number | null,
    (r) => (r as unknown as Record<string, unknown>).lng as number | null,
    cfg.filters.maxDistanceKm,
    geo,
  ) as PlaceProfileRow[];

  // Guest predicates cut the pool before the lists are ranked, so a family
  // whose places all fall outside the guest's cut drops its heading.
  const guestPredicates = readDeckPredicates(body.predicates);
  const pool = applyDeckPredicates(
    withinRadius as unknown as Record<string, unknown>[],
    guestPredicates,
  ) as unknown as PlaceProfileRow[];

  const wired = wirePlaces(pool);
  const signals = pool.map((row) => toLineupPlace(row as unknown as Record<string, unknown>));
  const rails = rankFamilyLists(
    wired,
    signals,
    cfg.catalog.ranking,
    cfg.params,
    { lat: geo.lat, lng: geo.lng },
    cfg.catalog.placesPerRail,
  );

  return json({
    ok: true,
    rails,
    summary: {
      pool: pool.length,
      admitted: withinRadius.length,
      lists: rails.length,
    },
  });
});
