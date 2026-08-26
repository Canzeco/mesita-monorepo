// Supabase Edge Function — consumer-web-list-catalog (product caller)
//
// The CATALOG engine — Home › Catalog stacked rails (Docs › Discovery).
// One round trip: sample Atlas seed categories + vibe-query rails, then
// fill each rail from the listed Mesita pool. Generated rails rank by
// place embedding cosine (OpenAI); embed miss falls back to token ILIKE.
// No Google. Map owns Nearby.
//
// Local:  supabase functions serve consumer-web-list-catalog
// Deploy: supabase functions deploy consumer-web-list-catalog

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { stripInternal } from "../_shared/place-pool-shape.ts";
import type { PlaceRow } from "../_shared/place-pool-shape.ts";
import { PLACE_CARD_COLUMNS } from "../_shared/place-columns.ts";
import { loadDiscoveryConfig } from "../_shared/discovery-config.ts";
import { DISCOVERY_EXTRA_COLUMNS } from "../_shared/discovery-place.ts";
import { applyDiscoveryFilters, trimToRadius } from "../_shared/discovery-filters.ts";
import { CATALOG_VIBE_QUERIES } from "../_shared/catalog-vibe-queries.ts";
import {
  matchIlike,
  occupiedFromRows,
  planCatalogRails,
  sliceSeedPlaces,
} from "../_shared/catalog-engine.ts";
import { embedBatch } from "../_shared/embeddings-http.ts";
import { rankByCosine } from "../_shared/embeddings-vector.ts";

const POOL_CAP = 1000;

type Body = {
  lat?: number;
  lng?: number;
};

function wirePlaces(rows: PlaceRow[]) {
  return rows.map((r) => {
    const out = stripInternal(r);
    return { ...out, photos: Array.isArray(out.photos) ? out.photos : [] };
  });
}

function fillGenerated(
  pool: PlaceRow[],
  query: string,
  queryVec: number[] | undefined,
  limit: number,
): PlaceRow[] {
  if (queryVec) {
    const ranked = rankByCosine(pool, queryVec).filter((r) => r.embedding != null);
    if (ranked.length > 0) return ranked.slice(0, limit);
  }
  return matchIlike(pool, query, limit);
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
    .eq("status", "active");

  const { data, error } = await applyDiscoveryFilters(base, cfg.filters, geo)
    .limit(POOL_CAP);

  if (error) {
    console.error("[list-catalog] pool:", error.message);
    return json({ ok: false, error: error.message }, 502);
  }

  const admitted = (data ?? []) as unknown as PlaceRow[];
  const pool = trimToRadius(
    admitted,
    (r) => (r as unknown as Record<string, unknown>).lat as number | null,
    (r) => (r as unknown as Record<string, unknown>).lng as number | null,
    cfg.filters.maxDistanceKm,
    geo,
  ) as PlaceRow[];

  const occupied = occupiedFromRows(pool, cfg.catalog.minSeedPlaces);
  const plan = planCatalogRails(cfg.catalog, occupied, CATALOG_VIBE_QUERIES);
  const generated = plan.filter((r) => r.source === "generated");
  const openaiKey = (Deno.env.get("OPENAI_KEY") ?? "").trim();

  let vectors: (number[] | undefined)[] = generated.map(() => undefined);
  if (generated.length > 0 && openaiKey) {
    try {
      const batch = await embedBatch(generated.map((r) => r.query), openaiKey);
      vectors = generated.map((_, i) => {
        const v = batch[i];
        return v && v.length > 0 ? v : undefined;
      });
    } catch (e) {
      console.error("[list-catalog] embed:", (e as Error).message);
    }
  }

  let genIdx = 0;
  const rails = [];
  for (const rail of plan) {
    const rows = rail.source === "seed"
      ? sliceSeedPlaces(pool, rail.query, cfg.catalog.placesPerRail)
      : fillGenerated(pool, rail.query, vectors[genIdx++], cfg.catalog.placesPerRail);
    if (rows.length === 0) continue;
    rails.push({
      key: rail.key,
      label: rail.label,
      source: rail.source,
      places: wirePlaces(rows),
    });
  }

  return json({
    ok: true,
    rails,
    summary: {
      pool: pool.length,
      seedPlanned: plan.filter((r) => r.source === "seed").length,
      generatedPlanned: generated.length,
    },
  });
});
