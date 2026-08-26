// Supabase Edge Function — supabase-edgefunc-discover-places (internal caller)
//
// Part of the Intaker namespace (place intelligence + encyclopaedia).
// Runs many Google Places Text Search queries in one batch and returns
// the union of Place IDs across all of them. Optional `placeIds` resolve
// via Place Details (Text Search cannot). Paginates each query up to
// the API max (3 pages × 20 = 60 results) and runs queries with bounded
// concurrency so a 50-query batch completes well inside the EF timeout.
//
// Quality floors and types come from Discovery › Map
// (`app_config.discovery_config.map`). A request body must not carry its own
// minRating / minUserRatingCount — those were a second authoring surface
// on Multiple Places and are ignored if sent. Applied EF-side after the
// Google fetch (Text Search has no review-count filter); filtering here
// also lets us report per-query rawCount so the UI can say "12 found ·
// 4 shown". Named Place IDs use the SAME gate after Place Details — one
// ineligible ID is that query's error, never a batch abort. rating +
// userRatingCount stay in the Text Search Pro SKU.
//
// Returned places are enriched with Mesita-side existence + timestamps so
// the product caller can render "already on Mesita" badges without a
// second round-trip.
//
// Auth: internal caller — verify_jwt = true, so the gateway verifies the
// service_role JWT signature; requireInternalCaller then checks role=service_role.
//
// Deploy: supabase functions deploy supabase-edgefunc-discover-places

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { requireInternalCaller } from "../_shared/internal.ts";
import { readGooglePlacesKey } from "../_shared/google-places.ts";
import { parseCldrRegionCode } from "../_shared/sourcing.ts";
import { loadDiscoveryConfig, type MapConfig } from "../_shared/discovery-config.ts";
import { evaluatePlaceForMap } from "../_shared/map-engine.ts";
import {
  fetchPlaceLiteById,
  MAX_RESULTS_PER_QUERY,
  searchTextWithPagination,
  type PlaceLite,
} from "./discover-places-search.ts";

// Batch cap. With concurrency 10 and ~3 pages × ~500ms per query, 200
// queries land in roughly 30 seconds — comfortably inside the EF timeout
// while still meaningful for an operator pasting a large list of
// "cuisine × city" combinations.
const MAX_QUERIES_PER_BATCH = 200;
const CONCURRENCY = 10;

type RequestBody = {
  queries?: string[];
  placeIds?: string[];
  regionCode?: string;
  maxResultsPerQuery?: number;
};

type QueryResult = {
  query: string;
  places: PlaceLite[];
  // Total places Google returned for this query, before quality filters.
  // places.length ≤ rawCount; the gap is what the filters removed.
  rawCount: number;
  truncated: boolean;
  error: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const env = envRes.env;

  const callerRes = requireInternalCaller(req, env);
  if (!callerRes.ok) return callerRes.response;

  const keyRes = readGooglePlacesKey();
  if (!keyRes.ok) return keyRes.response;
  const apiKey = keyRes.key;

  const admin = adminClient(env);

  const map = (await loadDiscoveryConfig(admin)).map;

  const bodyRes = await readJson<RequestBody>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const queries = Array.from(
    new Set(
      (body.queries ?? [])
        .map((q) => (typeof q === "string" ? q.trim() : ""))
        .filter((q) => q.length > 0),
    ),
  );
  const placeIds = Array.from(
    new Set(
      (body.placeIds ?? [])
        .map((q) => (typeof q === "string" ? q.trim() : ""))
        .filter((q) => q.length >= 18),
    ),
  );
  if (queries.length === 0 && placeIds.length === 0) {
    return json({ ok: false, error: "queries or placeIds: empty" });
  }
  if (queries.length + placeIds.length > MAX_QUERIES_PER_BATCH) {
    return json({
      ok: false,
      error: `queries + placeIds: max ${MAX_QUERIES_PER_BATCH} per batch (got ${queries.length + placeIds.length})`,
    });
  }

  const regionCode = parseCldrRegionCode(body.regionCode);
  const maxResults = Math.min(
    MAX_RESULTS_PER_QUERY,
    Math.max(1, body.maxResultsPerQuery ?? MAX_RESULTS_PER_QUERY),
  );

  // SoT: Discovery › Map. 0 = off.
  const minRating = map.minRating;
  const minUserRatingCount = map.minReviews;

  // --- Run text queries + Place ID lookups with bounded concurrency ---
  const results = new Array<QueryResult>(queries.length + placeIds.length);
  let cursor = 0;
  const textWorker = async () => {
    while (true) {
      const i = cursor++;
      if (i >= queries.length) return;
      const q = queries[i];
      try {
        const fetched = await searchTextWithPagination(
          q,
          maxResults,
          apiKey,
          regionCode,
        );
        const places = fetched.filter((p) =>
          passesMapFilter(p, map),
        );
        results[i] = {
          query: q,
          places,
          rawCount: fetched.length,
          truncated: fetched.length >= maxResults,
          error: null,
        };
      } catch (err) {
        results[i] = {
          query: q,
          places: [],
          rawCount: 0,
          truncated: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  };
  if (queries.length > 0) {
    await Promise.all(
      Array.from(
        { length: Math.min(CONCURRENCY, queries.length) },
        () => textWorker(),
      ),
    );
  }

  // Explicit Place IDs use Place Details, then the same Map
  // gate as text hits. One ineligible or missing ID fails that slot
  // only — the operator still gets the rest of the batch.
  let idCursor = 0;
  const idWorker = async () => {
    while (true) {
      const j = idCursor++;
      if (j >= placeIds.length) return;
      const id = placeIds[j];
      const slot = queries.length + j;
      try {
        const place = await fetchPlaceLiteById(id, apiKey);
        const verdict = evaluatePlaceForMap(map, {
          primaryType: place.primaryType,
          rating: place.rating,
          reviewCount: place.userRatingCount,
        });
        results[slot] = {
          query: id,
          places: verdict.eligible ? [place] : [],
          rawCount: 1,
          truncated: false,
          error: verdict.eligible ? null : verdict.reason,
        };
      } catch (err) {
        results[slot] = {
          query: id,
          places: [],
          rawCount: 0,
          truncated: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  };
  if (placeIds.length > 0) {
    await Promise.all(
      Array.from(
        { length: Math.min(CONCURRENCY, placeIds.length) },
        () => idWorker(),
      ),
    );
  }

  // --- Dedupe ---
  const seen = new Set<string>();
  const uniquePlaces: PlaceLite[] = [];
  for (const r of results) {
    for (const p of r.places) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        uniquePlaces.push(p);
      }
    }
  }

  // --- Enrich with Mesita existence + timestamps ---
  let mesitaLookupError: string | null = null;
  let mesitaMatchCount = 0;
  if (uniquePlaces.length > 0) {
    try {
      const ids = uniquePlaces.map((p) => p.id);
      const { data, error } = await admin
        .from("profiles")
        .select("google_place_id, created_at, updated_at")
        .in("google_place_id", ids);
      if (error) {
        mesitaLookupError = `Mesita lookup failed: ${error.message}`;
      } else {
        const byId = new Map<string, { created_at: string; updated_at: string }>();
        for (const row of data ?? []) {
          if (row.google_place_id) {
            byId.set(row.google_place_id, {
              created_at: row.created_at,
              updated_at: row.updated_at,
            });
          }
        }
        const applyEnrichment = (p: PlaceLite) => {
          const hit = byId.get(p.id);
          if (!hit) return;
          p.existsInMesita = true;
          p.createdAt = hit.created_at;
          p.updatedAt = hit.updated_at;
        };
        for (const p of uniquePlaces) applyEnrichment(p);
        for (const r of results) for (const p of r.places) applyEnrichment(p);
        mesitaMatchCount = byId.size;
      }
    } catch (err) {
      mesitaLookupError =
        err instanceof Error
          ? `Mesita lookup threw: ${err.message}`
          : `Mesita lookup threw: ${String(err)}`;
    }
  }

  // How many places the quality filters removed, summed across queries
  // (pre-dedupe — this is a "signal-to-noise" tally for the operator, not
  // a unique count).
  const rawTotal = results.reduce((n, r) => n + r.rawCount, 0);
  const keptTotal = results.reduce((n, r) => n + r.places.length, 0);
  const filteredOutCount = rawTotal - keptTotal;

  return json({
    ok: true,
    queries: results,
    uniquePlaces,
    uniqueCount: uniquePlaces.length,
    regionCode,
    maxResultsPerQuery: maxResults,
    minRating,
    minUserRatingCount,
    filteredOutCount,
    mesitaMatchCount,
    mesitaLookupError,
    caller: callerRes.callerName,
  });
});

// A place passes when it clears Discovery › Map (types + floors).
function passesMapFilter(p: PlaceLite, map: MapConfig): boolean {
  return evaluatePlaceForMap(map, {
    primaryType: p.primaryType,
    rating: p.rating,
    reviewCount: p.userRatingCount,
  }).eligible;
}
