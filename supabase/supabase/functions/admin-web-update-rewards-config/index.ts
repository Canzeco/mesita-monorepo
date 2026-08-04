// Supabase Edge Function — admin-web-update-rewards-config
//
// Naming: caller-verb-words. Caller = admin, verb = update, words = rewards-config.
//
// Writes the v7 Strategy × Class rewards matrix (MESITA-859) on the
// public.app_settings singleton from the admin console's Rewards Config page. A
// WHOLE-CONFIG write: the matrix is one coherent table, so the caller always
// sends the full config. normalizeConfig snaps every cell to the 5% grid
// (floor 5%, MESITA-866) and fills any gap from the launch defaults, so a
// malformed row can never land. See the getter +
// 20260722200000_rewards_config.sql for the shape.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { normalizeConfig } from "./rewards-config-normalize.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

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
  if (!norm.ok) return json({ ok: false, error: norm.error }, 400);

  const { data, error } = await admin
    .from("app_settings")
    .update({ rewards_config: norm.value, updated_by: userId })
    .eq("id", 1)
    .select("rewards_config, updated_at")
    .single();
  if (error) {
    return json({ ok: false, error: `rewards_config_update: ${error.message}` }, 500);
  }

  return json({
    ok: true,
    config: data.rewards_config,
    updatedAt: data.updated_at,
  });
});
