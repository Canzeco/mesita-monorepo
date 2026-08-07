// Supabase Edge Function — admin-web-update-reservations-config
//
// Naming: caller-verb-words. Caller = admin, verb = update, words = reservations-config.
//
// Writes the reservation-endpoint policy on the public.app_settings singleton from
// the admin console's Reservations Config page. Unlike the sourcing knobs this is a
// WHOLE-CONFIG write, not a per-key merge: `priority` is an ordered list, and a
// partial merge of an ordering is meaningless — the caller always sends the full
// policy. See the getter + 20260715120000_reservations_config.sql for the shape.
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
import { normalizeConfig } from "./reservations-config-normalize.ts";

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

  const norm = normalizeConfig(bodyRes.body.config);
  if (!norm.ok) return jsonError(norm.error, 400);

  const { data, error } = await admin
    .from("app_settings")
    .update({ reservations_config: norm.value, updated_by: userId })
    .eq("id", 1)
    .select("reservations_config, updated_at")
    .single();
  if (error) {
    return jsonError(`reservations_config_update: ${error.message}`, 500);
  }

  return json({
    ok: true,
    config: data.reservations_config,
    updatedAt: data.updated_at,
  });
});
