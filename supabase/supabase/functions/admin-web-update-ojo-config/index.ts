// Supabase Edge Function — admin-web-update-ojo-config
//
// Naming: caller-verb-words. Caller = admin, verb = update, words = ojo-config.
//
// WHOLE-BLOB write of Ojo's policy from admin Visits (Ojo card) —
// the house pattern for jsonb configs here. The thresholds are a related set
// (auto-pass sits above the review floor by construction), so a per-key merge
// could persist an inverted band; the client always sends the whole policy and
// _shared/ojo-config normalizes it. See 20260811210000_ojo_config.sql.
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
import { normalizeOjoConfig } from "../_shared/ojo-config.ts";

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

  const next = normalizeOjoConfig(bodyRes.body.config);

  const { data, error } = await admin
    .from("app_config")
    .update({ ojo_config: next, updated_by: userId })
    .eq("id", 1)
    .select("ojo_config, updated_at")
    .single();
  if (error) return jsonError(`ojo_config_update: ${error.message}`, 500);

  return json({
    ok: true,
    config: normalizeOjoConfig(data.ojo_config),
    updatedAt: data.updated_at,
  });
});
