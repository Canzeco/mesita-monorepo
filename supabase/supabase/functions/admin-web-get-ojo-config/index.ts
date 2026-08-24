// Supabase Edge Function — admin-web-get-ojo-config
//
// Naming: caller-verb-words. Caller = admin, verb = get, words = ojo-config.
//
// Returns Ojo's policy blob from the public.app_config singleton for the
// admin Visits page (Ojo card). Ojo is the proof-verification engine: it
// reads the screenshot a guest posts for an Instagram story / Google review
// (MESITA-1030 · ticket-proofs bucket) and returns a verdict. See
// 20260811210000_ojo_config.sql for the shape and MESITA-1034 for the engine.
//
// Engine shipped MESITA-1034. `enabled` defaults off so flipping it is the
// only behaviour change. Policy blob is `app_config.ojo_config`.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, jsonError, rejectUnlessMethods } from "../_shared/http.ts";
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

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const { data, error } = await admin
    .from("app_config")
    .select("ojo_config, updated_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) return jsonError(`ojo_config_read: ${error.message}`, 500);
  if (!data) return jsonError("app_config missing", 500);

  return json({
    ok: true,
    config: normalizeOjoConfig(data.ojo_config),
    updatedAt: data.updated_at,
  });
});
