// Supabase Edge Function — admin-web-get-discovery-config
//
// Naming: caller-verb-words. Caller = admin, verb = get, words =
// discovery-config.
//
// Returns the ranking model from the public.app_config singleton for the admin
// console's Discovery page: one exponent per earned signal, plus the bought
// slot lane. See _shared/discovery-config.ts for the shape and
// _shared/discovery-signals.ts for the signal vocabulary, which is
// code-defined — this endpoint serves numbers, never the list.
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
import { normalizeDiscoveryConfig } from "../_shared/discovery-config.ts";

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
    .select("discovery_config, updated_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) return jsonError(`discovery_config_read: ${error.message}`, 500);
  if (!data) return jsonError("app_config missing", 500);

  const row = data as { discovery_config: unknown; updated_at: string | null };
  return json({
    ok: true,
    config: normalizeDiscoveryConfig(row.discovery_config),
    updatedAt: row.updated_at,
  });
});
