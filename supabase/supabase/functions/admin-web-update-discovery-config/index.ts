// Supabase Edge Function — admin-web-update-discovery-config
//
// Naming: caller-verb-words. Caller = admin, verb = update, words =
// discovery-config.
//
// WHOLE-BLOB write of the ranking model — the house pattern for jsonb configs.
// The exponents are a RELATED SET: they are only meaningful against each other
// (w=2 against w=1 is what "twice as important" means), so a per-key merge
// could persist half of an operator's rebalance and leave a blend nobody
// designed. The client always sends the whole model and
// _shared/discovery-config normalizes it, rebuilding the weights map from
// SIGNAL_KEYS so a retired signal cannot survive in jsonb.
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
import { normalizeDiscoveryConfig } from "../_shared/discovery-config.ts";

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

  const next = normalizeDiscoveryConfig(bodyRes.body.config);

  const { data, error } = await admin
    .from("app_config")
    .update({ discovery_config: next, updated_by: userId })
    .eq("id", 1)
    .select("discovery_config, updated_at")
    .single();
  if (error) return jsonError(`discovery_config_update: ${error.message}`, 500);

  const row = data as { discovery_config: unknown; updated_at: string | null };
  return json({
    ok: true,
    config: normalizeDiscoveryConfig(row.discovery_config),
    updatedAt: row.updated_at,
  });
});
