// Supabase Edge Function — admin-web-create-project (admin caller / LIVE admin create path)
//
// The admin-app equivalent of business-web-create-project: an admin operator
// passes a Google Places `placeId` and gets back the ugly profile (Create
// 1–4, content_status ready, enriched_at null). Intaker is NOT queued —
// Enrich / Create+Enrich is a second call; guests vote on the Enrich tab.
// Core: createMinimalPlace (_shared/create-place.ts) with queueEnrich:false.
//
// Roles are simple now: admins create from the admin app via THIS function;
// businesses create from the business app via business-web-create-project.
//
// Gating: operator JWT → the admin allowlist (requireSuperAdmin checks the
// public.super_admins table — that table IS the admin allowlist; this is the
// same gate every other admin-* EF uses).
//
// Difference vs business-web-create-project: NO managers upsert — an admin creates an
// UNOWNED listing (listing_type='web'); ownership only ever lands when a business
// claims it and admin-web-decide-verification approves.
//
// Local:  supabase functions serve admin-web-create-project
// Deploy: supabase functions deploy admin-web-create-project

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv, requireSuperAdmin } from "../_shared/auth.ts";
import { createMinimalPlace } from "../_shared/create-place.ts";

type Body = { placeId?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const env = envRes.env;

  // Authenticate the admin operator against the admin allowlist.
  const authRes = await getAuthedUser(req, env);
  if (!authRes.ok) return authRes.response;
  const admin = adminClient(env);
  const guard = await requireSuperAdmin(admin, authRes.user, "Only admins can create places.");
  if (!guard.ok) return guard.response;

  // Parse input.
  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = (bodyRes.body.placeId ?? "").toString().trim();
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);

  const created = await createMinimalPlace({
    admin,
    callerName: "admin-web-create-project",
    googlePlaceId: placeId,
    queueEnrich: false,
  });
  if (!created.ok) return json(created.body, created.status);

  // `venue` is the legacy alias for pre-rename admin-web builds.
  return json(
    { ok: true, place: created.place, enrichment: created.enrichment },
    201,
  );
});
