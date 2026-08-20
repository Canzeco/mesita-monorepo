// Supabase Edge Function — admin-web-update-visits-config
//
// Naming: caller-verb-words. Caller = admin, verb = update, words =
// visits-config.
//
// WHOLE-BLOB write of the LOCAL context's policy from the admin console — the
// house pattern for jsonb configs here. The knobs are a related set (the tip
// preselection must be one of the offered presets; the staff backoff ceiling
// can never sit below its base interval), so a per-key merge could persist a
// bill step that opens on a value no chip shows. The client always sends the
// whole policy and _shared/visits-config normalizes it.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, jsonError, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { normalizeVisitsConfig } from "../_shared/visits-config.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const userId = authRes.user.id;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const bodyRes = await readJson<{ config?: unknown }>(req);
  if (!bodyRes.ok) return bodyRes.response;

  const next = normalizeVisitsConfig(bodyRes.body.config);

  const { data, error } = await admin
    .from("app_config")
    .update({ visits_config: next, updated_by: userId })
    .eq("id", 1)
    .select("visits_config, updated_at")
    .single();
  if (error) return jsonError(`visits_config_update: ${error.message}`, 500);

  return json({
    ok: true,
    config: normalizeVisitsConfig(data.visits_config),
    updatedAt: data.updated_at,
  });
});
