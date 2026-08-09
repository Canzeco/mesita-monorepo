// Supabase Edge Function — admin-web-update-verification-config
//
// Naming: caller-verb-words. Caller = admin, verb = update, words = verification-config.
//
// Writes Verification Config knobs on the public.app_settings singleton from
// the admin console. Body: { config: { …partial knobs… } } — at least one
// boolean knob required. Returns the full config after write.
//
// Knobs:
//   createPlacesAsVerified — catalog Verified Partner badge at create time
//   autoVerifyAiCall       — phone OTP auto-grants ownership
//   autoVerifyAiEmail      — email OTP auto-grants ownership
//   autoVerifyVideo         — video walkthrough auto-grants ownership
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, jsonError, jsonOk, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";

type ConfigPatch = {
  createPlacesAsVerified?: unknown;
  autoVerifyAiCall?: unknown;
  autoVerifyAiEmail?: unknown;
  autoVerifyVideo?: unknown;
};

type Body = {
  config?: ConfigPatch;
};

const KNOBS = [
  ["createPlacesAsVerified", "create_places_as_verified"],
  ["autoVerifyAiCall", "auto_verify_ai_call"],
  ["autoVerifyAiEmail", "auto_verify_ai_email"],
  ["autoVerifyVideo", "auto_verify_video"],
] as const;

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

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const patch = bodyRes.body.config;
  if (!patch || typeof patch !== "object") {
    return jsonError("config object required", 400);
  }

  const update: Record<string, boolean | string> = { updated_by: userId };
  for (const [camel, column] of KNOBS) {
    const value = patch[camel];
    if (value === undefined) continue;
    if (typeof value !== "boolean") {
      return jsonError(`config.${camel} must be a boolean`, 400);
    }
    update[column] = value;
  }
  if (Object.keys(update).length === 1) {
    return jsonError(
      "config must include at least one of createPlacesAsVerified | autoVerifyAiCall | autoVerifyAiEmail | autoVerifyVideo",
      400,
    );
  }

  const { data, error } = await admin
    .from("app_settings")
    .update(update)
    .eq("id", 1)
    .select(
      "create_places_as_verified, auto_verify_ai_call, auto_verify_ai_email, auto_verify_video, updated_at",
    )
    .single();
  if (error) {
    return jsonError(`verification_config_update: ${error.message}`, 500);
  }

  return jsonOk({
    config: {
      createPlacesAsVerified: data.create_places_as_verified === true,
      autoVerifyAiCall: data.auto_verify_ai_call !== false,
      autoVerifyAiEmail: data.auto_verify_ai_email !== false,
      autoVerifyVideo: data.auto_verify_video === true,
    },
    updatedAt: data.updated_at,
  });
});
