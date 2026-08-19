// Supabase Edge Function — admin-web-update-orders-config
//
// Naming: caller-verb-words. Caller = admin, verb = update, words =
// orders-config.
//
// WHOLE-BLOB write of the ORDER context's policy from the admin console — the
// house pattern for jsonb configs here. The quotas are a related set (Premium
// may never allow fewer orders than Free), so a per-key merge could persist an
// inverted pair; the client always sends the whole policy and
// _shared/orders-config normalizes it.
//
// TABLE NAME: app_config — the settings singleton, renamed from `app_settings`
// by the entity-model migrations (20260818090000–096000).
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
import { normalizeOrdersConfig } from "../_shared/orders-config.ts";

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

  const next = normalizeOrdersConfig(bodyRes.body.config);

  const { data, error } = await admin
    .from("app_config")
    .update({ orders_config: next, updated_by: userId })
    .eq("id", 1)
    .select("orders_config, updated_at")
    .single();
  if (error) return jsonError(`orders_config_update: ${error.message}`, 500);

  return json({
    ok: true,
    config: normalizeOrdersConfig(data.orders_config),
    updatedAt: data.updated_at,
  });
});
