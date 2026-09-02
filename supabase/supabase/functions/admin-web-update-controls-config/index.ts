// Supabase Edge Function — admin-web-update-controls-config
//
// Naming: caller-verb-words. Caller = admin, verb = update, words =
// controls-config.
//
// WHOLE-BLOB write of the Wallet's Credits policy from the admin console — the
// house pattern for jsonb configs here. The knobs are a related set (the
// ceiling can never sit below the floor; the default hold has to be a value
// inside the window it is the default for; Credits may never expire before
// they mature, which ties the expiry floor to the hold ceiling), so a per-key
// merge could persist a default no place could ever actually be given. The
// client always sends the whole policy and _shared/controls-config normalizes
// it.
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
import { normalizeControlsConfig } from "../_shared/controls-config.ts";

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

  const next = normalizeControlsConfig(bodyRes.body.config);

  const { data, error } = await admin
    .from("app_config")
    .update({ controls_config: next, updated_by: userId })
    .eq("id", 1)
    .select("controls_config, updated_at")
    .single();
  if (error) return jsonError(`controls_config_update: ${error.message}`, 500);

  return json({
    ok: true,
    config: normalizeControlsConfig(data.controls_config),
    updatedAt: data.updated_at,
  });
});
