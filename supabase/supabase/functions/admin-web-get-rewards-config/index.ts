// Supabase Edge Function — admin-web-get-rewards-config
//
// Naming: caller-verb-words. Caller = admin, verb = get, words = rewards-config.
//
// Returns the Promos config: the v11 ADDITIVE blob (MESITA-1069) when one has
// been saved (`config`, from app_config.promos_config.v11 — a leftover v10
// blob is handed back as-is and the client migrates it), plus the cap scalar.
// Before the first save there is no blob, only the cap, and the client opens
// on the launch defaults carrying it.
//
// The v8 legacy rule rows are gone with the reward_rules table: the blob is
// the one store, so there is nothing left to reconcile it against.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, jsonError, jsonOk, rejectUnlessMethods } from "../_shared/http.ts";
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
    .select("promos_config, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (settings.error) {
    return jsonError(`promos_config_read: ${settings.error.message}`, 500);
  }

  const cfg = (settings.data?.promos_config ?? {}) as Record<string, unknown>;
  const cap = typeof cfg.cap === "number" ? cfg.cap : null;
  // The additive config — null until the first save, in which case the client
  // seeds from the legacy rows. A leftover v10 blob is handed back as-is and
  // the client migrates it to v11 (coercePromosConfig), so the page opens on
  // the operator's real numbers rather than the launch defaults.
  const isBlob = (v: unknown) =>
    !!v && typeof v === "object" && !Array.isArray(v);
  const config = isBlob(cfg.v11) ? cfg.v11 : isBlob(cfg.v10) ? cfg.v10 : null;

  // One store, so one "Updated" stamp.
  const stamp = settings.data?.updated_at as string | null | undefined;
  const updatedAt = typeof stamp === "string" ? stamp : null;

  return jsonOk({
    config,
    cap,
    updatedAt,
  });
});
