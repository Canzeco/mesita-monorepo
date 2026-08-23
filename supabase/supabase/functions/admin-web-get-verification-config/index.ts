// Supabase Edge Function — admin-web-get-verification-config
//
// Naming: caller-verb-words. Caller = admin, verb = get, words = verification-config.
//
// Returns every Verification Config knob from the public.app_config singleton
// for the admin console's Verification Config page:
//
//   create_places_as_verified — catalog Mesita Partner badge at create time
//   auto_verify_ai_call       — phone OTP auto-grants ownership
//   auto_verify_ai_email      — email OTP auto-grants ownership
//
// `auto_verify_video` retired (MESITA-1248) — nothing ever read it; see
// admin-web-update-verification-config's header for the full finding.
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
    .from("app_config")
    .select(
      "create_places_as_verified, auto_verify_ai_call, auto_verify_ai_email, updated_at",
    )
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    return jsonError(`verification_config_read: ${error.message}`, 500);
  }
  if (!data) {
    return jsonError("app_config missing", 500);
  }

  return jsonOk({
    config: {
      createPlacesAsVerified: data.create_places_as_verified === true,
      autoVerifyAiCall: data.auto_verify_ai_call !== false,
      autoVerifyAiEmail: data.auto_verify_ai_email !== false,
    },
    updatedAt: data.updated_at,
  });
});
