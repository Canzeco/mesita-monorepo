// Supabase Edge Function — consumer-web-list-catalog (product caller)
//
// The CATALOG engine. One round trip: Mesita places, then one shared
// ranking profile, then one row per guest family.
// Scope is Mesita Places or Mesita Enriched Places. Google is not a
// catalog set. Family is not a cut: All comes first, then one row per
// guest family. A place in two families is in both of those rows. No per-row cap.
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
import {
  DISCOVERY_EXTRA_COLUMNS,
  toLineupPlace,
} from "../_shared/discovery-place.ts";
import {
  type CatalogListPlace,
  rankFamilyLists,
} from "../_shared/catalog-rank.ts";
import {
  applyDeckPredicates,
  readDeckPredicates,
} from "../_shared/discovery-predicates.ts";

const POOL_CAP = 1000;

type Body = {
  lat?: number;
  lng?: number;
  /** Mesita scope. Family and a review floor are ignored. Google is not a catalog scope. */
  predicates?: unknown;
};

function catalogScope(raw: unknown): "enriched" | "mesita" {
  if (!raw || typeof raw !== "object") return "enriched";
  const scope = (raw as { placesScope?: unknown }).placesScope;
  return scope === "mesita" ? "mesita" : "enriched";
}

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

  const scope = catalogScope(body.predicates);
  let query = base.eq("content_state", "ready");
  if (scope === "enriched") query = query.not("enriched_at", "is", null);

  const { data, error } = await query.limit(POOL_CAP);

  if (error) {
    console.error("[list-catalog] pool:", error.message);
    return json({ ok: false, error: error.message }, 502);
  }

  const fetched = (data ?? []) as unknown as PlaceProfileRow[];
  const guestPredicates = {
    ...readDeckPredicates(body.predicates),
    familyKeys: [],
    minReviews: 0,
  };
  const pool = applyDeckPredicates(
    fetched as unknown as Record<string, unknown>[],
    guestPredicates,
  ) as unknown as PlaceProfileRow[];

  const wired = wirePlaces(pool);
  const signals = pool.map((row) =>
    toLineupPlace(row as unknown as Record<string, unknown>)
  );
  const rails = rankFamilyLists(
    wired,
    signals,
    cfg.catalog.ranking,
    cfg.params,
    { lat: geo.lat, lng: geo.lng },
    undefined,
    scope === "enriched",
  );

  return json({
    ok: true,
    rails,
    summary: {
      pool: pool.length,
      lists: rails.length,
    },
  });
});
