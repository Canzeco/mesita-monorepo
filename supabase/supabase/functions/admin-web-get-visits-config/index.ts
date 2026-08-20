// Supabase Edge Function — admin-web-get-visits-config
//
// Naming: caller-verb-words. Caller = admin, verb = get, words = visits-config.
//
// Returns the LOCAL context's policy from the public.app_config singleton for
// the admin console's Visits Config page — the knobs THE TICKET runs on (tips,
// poll cadence, proof, send-backs, pay rails, abandonment). What a visit PAYS
// is the Promos grid; who reads the proof is Ojo. See _shared/visits-config.ts
// for the shape.
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
import { normalizeVisitsConfig } from "../_shared/visits-config.ts";

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
    .select("visits_config, updated_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) return jsonError(`visits_config_read: ${error.message}`, 500);
  if (!data) return jsonError("app_config missing", 500);

  return json({
    ok: true,
    config: normalizeVisitsConfig(data.visits_config),
    updatedAt: data.updated_at,
  });
});
