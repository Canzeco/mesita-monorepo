// Supabase Edge Function — admin-web-update-verification-config
//
// Naming: caller-verb-words. Caller = admin, verb = update, words = verification-config.
//
// Writes Verification Config knobs on the public.app_settings singleton from
// the admin console. Body: { config: { createPlacesAsVerified: boolean } }.
// See the getter + 20260805080000_verification_config.sql.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, methodNotAllowed, readJson } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";

type Body = {
  config?: {
    createPlacesAsVerified?: unknown;
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") return methodNotAllowed();

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const userId = authRes.user.id;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const flag = bodyRes.body.config?.createPlacesAsVerified;
  if (typeof flag !== "boolean") {
    return json(
      { ok: false, error: "config.createPlacesAsVerified must be a boolean" },
      400,
    );
  }

  const { data, error } = await admin
    .from("app_settings")
    .update({
      create_places_as_verified: flag,
      updated_by: userId,
    })
    .eq("id", 1)
    .select("create_places_as_verified, updated_at")
    .single();
  if (error) {
    return json(
      { ok: false, error: `verification_config_update: ${error.message}` },
      500,
    );
  }

  return json({
    ok: true,
    config: {
      createPlacesAsVerified: data.create_places_as_verified === true,
    },
    updatedAt: data.updated_at,
  });
});
