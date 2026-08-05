// Supabase Edge Function — admin-web-get-scoring-config
//
// Compat alias of admin-web-get-lineup-config. scoring_config is NOT NULL with
// locked v12 defaults since MESITA-737; coerce still runs client-side.
//
// Auth: caller's JWT email must be in public.super_admins.
// verify_jwt = true gates non-bearer callers at the gateway.

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
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const { data, error } = await admin
    .from("app_settings")
    .select("scoring_config")
    .eq("id", 1)
    .single();
  if (error) {
    return json({ ok: false, error: `scoring_config_get: ${error.message}` }, 500);
  }

  return json({ ok: true, config: data?.scoring_config ?? null });
});
