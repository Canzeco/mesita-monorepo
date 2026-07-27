// Supabase Edge Function — admin-web-get-rewards-config
//
// Naming: caller-verb-words. Caller = admin, verb = get, words = rewards-config.
//
// Returns the six-segment reward grid (Promos v5, MESITA-723) from the
// public.app_settings singleton for the admin console's Rewards Config page: for
// each strategy (zero / conservative / aggressive), what each segment pays
// (standard · magnetic · premium · story · welcome · review), plus the universal
// cap. See 20260722200000_rewards_config.sql.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const { data, error } = await admin
    .from("app_settings")
    .select("rewards_config, updated_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    return json({ ok: false, error: `rewards_config_read: ${error.message}` }, 500);
  }
  if (!data) {
    return json({ ok: false, error: "app_settings missing" }, 500);
  }

  return json({
    ok: true,
    config: data.rewards_config,
    updatedAt: data.updated_at,
  });
});
