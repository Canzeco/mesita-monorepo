// Supabase Edge Function — supabase-edgefunc-discover-places (internal caller)
//
// Part of the Enricher namespace (place intelligence + encyclopaedia).
// Runs many Google Places Text Search queries in one batch and returns
// the union of Place IDs across all of them. Paginates each query up to
// the API max (3 pages × 20 = 60 results) and runs queries with bounded
// concurrency so a 50-query batch completes well inside the EF timeout.
//
// Quality filters (optional): minRating and minUserRatingCount let the
// operator drop low-signal places (a place with 800 reviews at 4.6 is
// almost always a real, good place; one with 3 reviews usually isn't).
// Both are applied EF-side after the Google fetch — Google's Text Search
// has no server-side review-count filter, and filtering both here (rather
// than passing minRating natively) keeps a single code path AND lets us
// report per-query rawCount (fetched before filtering) so the UI can say
// "12 found · 4 shown" instead of a bare "4" that reads like the search
// found nothing. rating + userRatingCount stay in the Text Search Pro
// SKU, so surfacing them does not change the per-call price.
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
import {
  evaluatePlaceForChannel,
  readChannelPolicy,
  type ChannelPolicy,
} from "../_shared/sourcing.ts";
import {
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
  regionCode?: string;
  maxResultsPerQuery?: number;
  // Quality filters. minRating is 0–5 (Google ratings are 1–5); 0 = off.
  // minUserRatingCount is a review-count floor; 0 = off. A place must
  // clear BOTH to survive. Places Google returns without a rating or
  // review count are treated as "unknown" and dropped only when the
  // corresponding filter is active (see passesQualityFilter).
  minRating?: number;
  minUserRatingCount?: number;
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

  const adminSearchPolicy = await readChannelPolicy(admin, "admin_search");

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
  if (queries.length === 0) {
    return json({ ok: false, error: "queries: empty" });
  }
  if (queries.length > MAX_QUERIES_PER_BATCH) {
    return json({
      ok: false,
      error: `queries: max ${MAX_QUERIES_PER_BATCH} per batch (got ${queries.length})`,
    });
  }

  const regionCode = ((body.regionCode ?? "MX") || "MX").toUpperCase();
  const maxResults = Math.min(
    MAX_RESULTS_PER_QUERY,
    Math.max(1, body.maxResultsPerQuery ?? MAX_RESULTS_PER_QUERY),
  );

  // Quality filters — request body overrides win; otherwise fall back to the
  // admin_search channel policy from app_settings.sourcing_config.
  const minRating = clamp(
    Number(body.minRating ?? adminSearchPolicy.minRating ?? 0),
    0,
    5,
  );
  const minUserRatingCount = Math.max(
    0,
    Math.floor(Number(body.minUserRatingCount ?? adminSearchPolicy.minReviews ?? 0)),
  );

  // --- Run queries with bounded concurrency ---
  const results = new Array<QueryResult>(queries.length);
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const i = cursor++;
      if (i >= queries.length) return;
      const q = queries[i];
      try {
        const fetched = await searchTextWithPagination(q, regionCode, maxResults, apiKey);
        const places = fetched.filter((p) =>
          passesSourcingFilter(p, adminSearchPolicy, minRating, minUserRatingCount),
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
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queries.length) }, () => worker()),
  );

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
        .from("projects_view")
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

// A place passes when it clears the admin_search channel policy (family +
// rating/review floors). Request-body floors are merged with the policy
// floors — the stricter of each pair wins.
function passesSourcingFilter(
  p: PlaceLite,
  policy: ChannelPolicy,
  minRating: number,
  minUserRatingCount: number,
): boolean {
  const effectivePolicy: ChannelPolicy = {
    ...policy,
    minRating: Math.max(policy.minRating, minRating),
    minReviews: Math.max(policy.minReviews, minUserRatingCount),
  };
  return evaluatePlaceForChannel(effectivePolicy, {
    primaryType: p.primaryType,
    rating: p.rating,
    reviewCount: p.userRatingCount,
  }).eligible;
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}
