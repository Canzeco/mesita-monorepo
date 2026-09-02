// Supabase Edge Function — admin-web-get-controls-config
//
// Naming: caller-verb-words. Caller = admin, verb = get, words = controls-config.
//
// Returns the Wallet's Credits policy from the public.app_config singleton for
// the admin console's Controls Config page — the hold a place inherits when it
// sets none, the bonus that goes with it, and the ceiling on a per-place
// override. Whether Credits may settle a bill at all is a different question
// answered by visits_config.payCredits. See _shared/controls-config.ts.
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
import { normalizeControlsConfig } from "../_shared/controls-config.ts";

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
    .select("controls_config, updated_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) return jsonError(`controls_config_read: ${error.message}`, 500);
  if (!data) return jsonError("app_config missing", 500);

  return json({
    ok: true,
    config: normalizeControlsConfig(data.controls_config),
    updatedAt: data.updated_at,
  });
});
