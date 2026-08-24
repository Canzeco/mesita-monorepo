// Supabase Edge Function — admin-web-update-verification-config
//
// Naming: caller-verb-words. Caller = admin, verb = update, words = verification-config.
//
// Writes Verification Config knobs into the public.app_config singleton's
// verification_config jsonb column (MESITA-1248 fold of three loose scalar
// columns). Body: { config: { …partial knobs… } } — at least one boolean
// knob required. Returns the full config after write.
//
// Knobs:
//   createPlacesAsVerified — catalog Mesita Partner badge at create time
//   autoVerifyAiCall       — phone OTP auto-grants ownership
//   autoVerifyAiEmail      — email OTP auto-grants ownership
//
// `autoVerifyVideo` retired (MESITA-1248) — nothing ever read it.
// `admin-web-list-verifications` shows every video row regardless of the
// flag, and the console never rendered a control for it (see
// verification-config/VerificationConfigClient.tsx's own comment, which
// flagged this exact cleanup). `auto_verify_video` dropped in the same
// migration that removed it here.
//
// READ-MERGE-WRITE, not a blind jsonb replace: the console genuinely saves
// one switch at a time (`updateVerificationConfig({ [key]: next })` on every
// flip, not a whole-object submit — VerificationConfigClient.tsx's own
// optimistic-save UX), so writing only the incoming key(s) as a fresh object
// would silently blank the other two on every toggle. This does reintroduce
// a lost-update race the old per-column `.update()` didn't have (two
// concurrent admin saves could clobber each other) — accepted deliberately:
// this page has exactly one operator (super-admin only), flips are rare, and
// the failure mode is "re-flip a switch", not data corruption or a security
// bypass. A true atomic merge would need a jsonb `||` RPC; not worth the
// extra surface for this risk profile.
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
import { normalizeVerificationConfig } from "../_shared/verification-config.ts";

type ConfigPatch = {
  createPlacesAsVerified?: unknown;
  autoVerifyAiCall?: unknown;
  autoVerifyAiEmail?: unknown;
};

type Body = {
  config?: ConfigPatch;
};

const KNOBS = ["createPlacesAsVerified", "autoVerifyAiCall", "autoVerifyAiEmail"] as const;

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

  const incoming: Partial<Record<typeof KNOBS[number], boolean>> = {};
  for (const key of KNOBS) {
    const value = patch[key];
    if (value === undefined) continue;
    if (typeof value !== "boolean") {
      return jsonError(`config.${key} must be a boolean`, 400);
    }
    incoming[key] = value;
  }
  if (Object.keys(incoming).length === 0) {
    return jsonError(
      "config must include at least one of createPlacesAsVerified | autoVerifyAiCall | autoVerifyAiEmail",
      400,
    );
  }

  const { data: current, error: readError } = await admin
    .from("app_config")
    .select("verification_config")
    .eq("id", 1)
    .maybeSingle();
  if (readError) {
    return jsonError(`verification_config_read: ${readError.message}`, 500);
  }
  const merged = {
    ...normalizeVerificationConfig(
      (current as { verification_config?: unknown } | null)?.verification_config,
    ),
    ...incoming,
  };

  const { data, error } = await admin
    .from("app_config")
    .update({ verification_config: merged, updated_by: userId })
    .eq("id", 1)
    .select("verification_config, updated_at")
    .single();
  if (error) {
    return jsonError(`verification_config_update: ${error.message}`, 500);
  }

  return jsonOk({
    config: normalizeVerificationConfig(data.verification_config),
    updatedAt: data.updated_at,
  });
});
