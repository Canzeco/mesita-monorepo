// Supabase Edge Function — admin-web-get-orders-config
//
// Naming: caller-verb-words. Caller = admin, verb = get, words = orders-config.
//
// Returns the ORDER context's policy blob from the public.app_settings
// singleton for the admin console's Orders Config page. Orders are the remote
// half of the two contexts Promos prices; the rail itself is parked, so every
// knob here is labeled STAGED in the console. See _shared/orders-config.ts for
// the shape and 20260818120000_orders_config.sql for the column.
//
// TABLE NAME: app_config, not app_settings. The entity-model rename landed on
// the live singleton on 2026-08-18 (migrations 20260818090000–096000, applied
// cloud-side and not yet mirrored into this repo) and took `app_settings` with
// it — which is why every OTHER admin config EF here is currently 500ing
// against live. These two are written for the world the rename created; the
// sweep that fixes their siblings will find them already correct.
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
import { normalizeOrdersConfig } from "../_shared/orders-config.ts";

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
    .select("orders_config, updated_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) return jsonError(`orders_config_read: ${error.message}`, 500);
  if (!data) return jsonError("app_settings missing", 500);

  return json({
    ok: true,
    config: normalizeOrdersConfig(data.orders_config),
    updatedAt: data.updated_at,
  });
});
