// Supabase Edge Function — admin-web-get-models-config
//
// Naming: caller-verb-words. Caller = admin, verb = get, words = models-config.
//
// Returns the central models config from the public.app_settings singleton for
// the admin console's Models Config page (admin.mesita.ai/models-config). One
// { provider, model } per subsystem (supabase / enricher / lineup / memo). NULL
// means "no blob yet → the client falls back to its DEFAULTS". See
// 20260726000000_models_config.sql for the column + shape.
//
// STAGED: this is a plain read. The subsystems are pointed at the blob in a
// follow-up; shape validation lives on the write path
// (admin-web-update-models-config). Deliberately overlaps the Memo Config model
// knob by design.
//
// Auth: caller's JWT email must be in public.super_admins. verify_jwt defaults
// to true at the gateway (no config.toml entry, mirroring the memo/lineup pair).

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
    .select("models_config")
    .eq("id", 1)
    .single();
  if (error) {
    return json({ ok: false, error: `models_config_get: ${error.message}` }, 500);
  }

  return json({ ok: true, config: data?.models_config ?? null });
});
