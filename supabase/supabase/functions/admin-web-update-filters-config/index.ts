// Supabase Edge Function — admin-web-update-filters-config
//
// Naming: caller-verb-words. Caller = admin, verb = update, words = filters-config.
//
// The payload is the whole Filters config (MESITA-1083): general (modules,
// defaults, bounds, behavior) plus one entry per consumer surface. It is
// written as the `v1` key on app_settings.filters_config, MERGE-preserving the
// blob's other keys so a future v2 can land beside it.
//
// A WHOLE-BLOB write: the caller always sends the complete config and
// normalizeFiltersV1 always returns a complete one. That is what lets the
// admin's Swipe tab save without dropping General — every tab posts the same
// object, edited in one place.
//
// STAGED: nothing reads this blob yet. It exists so the policy and the
// consumer wiring can ship independently, exactly like ojo_config.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  jsonError,
  jsonOk,
  readJson,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { normalizeFiltersV1 } from "./filters-v1-normalize.ts";

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

  const config = normalizeFiltersV1(bodyRes.body.config);

  // Read-modify-write the surrounding blob so unrelated keys survive. The
  // singleton row always exists (id = 1), so a missing row is a real fault
  // rather than something to create on the fly.
  const current = await admin
    .from("app_settings")
    .select("filters_config")
    .eq("id", 1)
    .maybeSingle();

  if (current.error) {
    return jsonError(`filters_config_read: ${current.error.message}`, 500);
  }

  const existing = (current.data?.filters_config ?? {}) as Record<
    string,
    unknown
  >;
  const merged = { ...existing, v1: config };

  const wrote = await admin
    .from("app_settings")
    .update({
      filters_config: merged,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq("id", 1)
    .select("filters_config, updated_at")
    .maybeSingle();

  if (wrote.error) {
    return jsonError(`filters_config_write: ${wrote.error.message}`, 500);
  }

  return jsonOk({
    config,
    updatedAt: (wrote.data?.updated_at as string | null) ?? null,
  });
});
