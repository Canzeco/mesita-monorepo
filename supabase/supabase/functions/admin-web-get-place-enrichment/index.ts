// Supabase Edge Function — admin-web-get-place-enrichment (product caller / admin)
//
// Read-only per-place Enricher inspector for the admin console. Given a
// place id, returns `state`: places.content_state and last_enriched_at
// (enriched_at via the profiles view, the one Render write, MESITA-2811). The
// place_research stage row and its SERP Summary went with the retired stage
// path (MESITA-2424).
//
// Internal enricher output — super-admin gated, admin console only. Never
// exposed through a shared business EF.
//
// Local:  supabase functions serve admin-web-get-place-enrichment
// Deploy: supabase functions deploy admin-web-get-place-enrichment

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, jsonError, readJson, rejectUnlessMethods, readPlaceIdAlias } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";

type Body = { projectId?: string; placeId?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  // `placeId` is the canonical MESITA-26 key; `projectId` is the legacy alias
  // the business console still sends here. readPlaceIdAlias accepts both
  // (placeId wins).
  const placeId = readPlaceIdAlias(bodyRes.body);
  if (!placeId) return jsonError("Missing placeId", 400);

  // The profiles view carries both content_state (places) and enriched_at.
  const placeRes = await admin
    .from("profiles")
    .select("content_state, enriched_at")
    .eq("id", placeId)
    .maybeSingle();
  if (placeRes.error) {
    return jsonError(`places: ${placeRes.error.message}`, 500);
  }

  const state = {
    content_state: (placeRes.data?.content_state ?? null) as string | null,
    // Enriched is enriched_at: Render's write stamps it.
    last_enriched_at: (placeRes.data?.enriched_at ?? null) as string | null,
  };

  return json({ ok: true, state });
});
