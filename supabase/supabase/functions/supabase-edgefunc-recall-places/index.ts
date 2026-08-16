// Supabase Edge Function — supabase-edgefunc-recall-places (internal caller)
//
// Memo's RAG leg. One of the four endpoints that make up Memo's entire data
// surface (see _shared/memo-data.ts); Memo itself holds no database client.
//
// Recall a candidate pool near the caller, embed the intent, cosine-rank the
// catalog, return the top PUBLIC cards. Doing the whole leg here means one hop
// replaces a query + an embedding call + a rank on Memo's side — and the
// embedding vectors and OPENAI_KEY never leave this function.
//
// Was `supabase-edgefunc-recall-lineup` until MESITA-1048. Only the name
// changed: this endpoint never ran the deleted Lineup scoring engine, it runs
// plain cosine relevance over place embeddings, which is a live product
// feature and stays exactly as it was.
//
// Read-only and non-persisting BY DESIGN: it deliberately does NOT lazy-embed
// and write back. Memo never writes.
//
// Naming: actor-origin-verb-noun -> supabase . edgefunc . recall . places.
// Auth: verify_jwt = true + requireInternalCaller (service-role bearer).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { requireInternalCaller } from "../_shared/internal.ts";
import { fetchCandidatePool, type PlaceRow } from "../_shared/place-pool.ts";
import { embedSingle, rankByCosine } from "../_shared/embeddings.ts";
import { rowToMemoPlaceCard } from "../_shared/memo-place-card.ts";

const RECALL_RADIUS_KM = 25;
const RECALL_POOL = 200;
const DEFAULT_LIMIT = 4;
const MAX_LIMIT = 10;

type Body = {
  intent?: unknown;
  lat?: unknown;
  lng?: unknown;
  limit?: unknown;
};

function coord(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const callerRes = requireInternalCaller(req, envRes.env);
  if (!callerRes.ok) return callerRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const intent = (typeof body.intent === "string" ? body.intent : "").trim();
  const lat = coord(body.lat);
  const lng = coord(body.lng);
  const limit = typeof body.limit === "number" && Number.isFinite(body.limit)
    ? Math.min(MAX_LIMIT, Math.max(1, Math.trunc(body.limit)))
    : DEFAULT_LIMIT;

  const admin = adminClient(envRes.env);
  const pool = await fetchCandidatePool<PlaceRow>(admin, {
    lat,
    lng,
    radiusKm: RECALL_RADIUS_KM,
    poolSize: RECALL_POOL,
  });
  if (!pool.ok) {
    console.error("[recall-places] pool:", pool.error);
    return json({ ok: true, cards: [], poolSize: 0, embedded: false });
  }
  if (pool.rows.length === 0) {
    return json({ ok: true, cards: [], poolSize: 0, embedded: false });
  }

  // Embed + cosine-rank when we have both an intent and a key; otherwise the
  // pool's own order stands. A ranking miss degrades relevance, never the call.
  const openaiKey = Deno.env.get("OPENAI_KEY") ?? "";
  let ranked = pool.rows;
  let embedded = false;
  if (openaiKey && intent.length > 0) {
    try {
      const vec = await embedSingle(intent, openaiKey);
      ranked = rankByCosine(pool.rows, vec);
      embedded = true;
    } catch (e) {
      console.error("[recall-places] embed:", (e as Error).message);
    }
  }

  // Project to public cards — this is where the embedding column stops.
  // Nothing past this line carries a field Memo shouldn't see.
  const cards = ranked
    .slice(0, limit)
    .map((r) => rowToMemoPlaceCard(r as unknown as Record<string, unknown>));

  return json({
    ok: true,
    cards,
    poolSize: pool.rows.length,
    embedded,
    caller: callerRes.callerName,
  });
});
