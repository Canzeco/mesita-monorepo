// Supabase Edge Function — admin-web-get-verification-config
//
// Naming: caller-verb-words. Caller = admin, verb = get, words = verification-config.
//
// Returns the Verification Config knobs from the public.app_settings singleton
// for the admin console's Verification Config page. Today: one flag —
// create_places_as_verified — that decides whether newly created places land
// as listing_type='partner' (Verified Partner) without phone ownership proof.
// See 20260805080000_verification_config.sql.
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

  const { data, error } = await admin
    .from("app_settings")
    .select("create_places_as_verified, updated_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    return jsonError(`verification_config_read: ${error.message}`, 500);
  }
  if (!data) {
    return jsonError("app_settings missing", 500);
  }

  return jsonOk({ config: {
      createPlacesAsVerified: data.create_places_as_verified === true,
    },
    updatedAt: data.updated_at, });
});
