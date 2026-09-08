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
import type { PlaceProfileRow } from "../_shared/place-pool-shape.ts";
import { PLACE_CARD_COLUMNS } from "../_shared/place-columns.ts";
import { loadDiscoveryConfig } from "../_shared/discovery-config.ts";
import { DISCOVERY_EXTRA_COLUMNS } from "../_shared/discovery-place.ts";
import { applyDiscoveryFilters, trimToRadius } from "../_shared/discovery-filters.ts";
import {
  applyDeckPredicates,
  readDeckPredicates,
} from "../_shared/discovery-predicates.ts";
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
  /**
   * The guest's four discovery predicates (MESITA-1697). Feed grew a filter
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
   * operator pool exactly as before, which is what every deployed Expo binary
   * sends.
   */
  predicates?: unknown;
};

function wirePlaces(rows: PlaceProfileRow[]) {
  return rows.map((r) => {
    const out = stripInternal(r);
    return { ...out, photos: Array.isArray(out.photos) ? out.photos : [] };
  });
}

function fillGenerated(
  pool: PlaceProfileRow[],
  query: string,
  queryVec: number[] | undefined,
  limit: number,
): PlaceProfileRow[] {
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

  // GUEST PREDICATES CUT THE POOL, before rails are planned or filled. Rail
  // OCCUPANCY is computed from the cut pool too, so a category whose only
  // places are closed right now stops producing a heading at all rather than
  // producing an empty one.
  const guestPredicates = readDeckPredicates(body.predicates);
  const pool = applyDeckPredicates(
    withinRadius as unknown as Record<string, unknown>[],
    guestPredicates,
    geo.lat !== null && geo.lng !== null
      ? { lat: geo.lat, lng: geo.lng }
      : null,
  ) as unknown as PlaceProfileRow[];

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
      admitted: withinRadius.length,
      seedPlanned: plan.filter((r) => r.source === "seed").length,
      generatedPlanned: generated.length,
    },
  });
});
