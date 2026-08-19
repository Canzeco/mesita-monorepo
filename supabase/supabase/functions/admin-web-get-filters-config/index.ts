// Supabase Edge Function — admin-web-get-filters-config
//
// Naming: caller-verb-words. Caller = admin, verb = get, words = filters-config.
//
// Returns the Filters config: the v1 blob under app_config.filters_config.v1
// (MESITA-1083), or null when nothing has been saved yet. Null is meaningful,
// not an error — the console renders the code defaults and says out loud that
// they are launch values rather than an operator's choices, so it must be able
// to tell "unset" from "set to the defaults".
//
// The blob is returned AS STORED. Normalizing is the client's job
// (coerceFiltersConfig) and the writer's (normalizeFiltersV1), so a blob
// written by a newer client still round-trips through an older reader.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  jsonError,
  jsonOk,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";

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

  const settings = await admin
    .from("app_config")
    .select("filters_config, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (settings.error) {
    return jsonError(`filters_config_read: ${settings.error.message}`, 500);
  }

  const cfg = (settings.data?.filters_config ?? {}) as Record<string, unknown>;
  const isBlob = (v: unknown) =>
    !!v && typeof v === "object" && !Array.isArray(v);
  const config = isBlob(cfg.v1) ? cfg.v1 : null;

  return jsonOk({
    config,
    updatedAt: (settings.data?.updated_at as string | null) ?? null,
  });
});
