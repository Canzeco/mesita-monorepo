// Supabase Edge Function — admin-web-get-verification-config
//
// Naming: caller-verb-words. Caller = admin, verb = get, words = verification-config.
//
// Returns every Verification Config knob from the public.app_config
// singleton's verification_config jsonb column (MESITA-1248 fold of three
// loose scalar columns) for the admin console's Verification Config page:
//
//   createPlacesAsVerified — catalog Mesita Partner badge at create time
//   autoVerifyAiCall       — phone OTP auto-grants ownership
//   autoVerifyAiEmail      — email OTP auto-grants ownership
//
// `auto_verify_video`/`autoVerifyVideo` retired (MESITA-1248, separate PR)
// — nothing ever read it; see admin-web-update-verification-config's header
// for the full finding.
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
import { normalizeVerificationConfig } from "../_shared/verification-config.ts";

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
    .select("verification_config, updated_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    return jsonError(`verification_config_read: ${error.message}`, 500);
  }
  if (!data) {
    return jsonError("app_config missing", 500);
  }

  return jsonOk({
    config: normalizeVerificationConfig(data.verification_config),
    updatedAt: data.updated_at,
  });
});
