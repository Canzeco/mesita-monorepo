// Supabase Edge Function — admin-web-get-config
//
// Returns the full public.app_config singleton row to the admin web.
// One central read for every admin page that needs to surface a flag:
//
//   autoVerifyAiCall  — verification auto-approve (call OTP)
//   autoVerifyAiEmail — verification auto-approve (email OTP)
//   (both live in the verification_config jsonb column, MESITA-1248 fold)
//
// `auto_verify_video`/`autoVerifyVideo` retired (MESITA-1248, separate PR)
// — nothing ever read it; see admin-web-update-verification-config's header
// for the full finding.
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
import {
  enrichmentTriggersMeta,
  normalizeEnrichmentTriggers,
} from "../_shared/enrich-triggers.ts";
import { normalizeEnrichmentConfig } from "../_shared/enrichment-config.ts";
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
    .select(
      "verification_config, enrichment_config, enrichment_triggers, updated_at",
    )
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    return jsonError(`settings_read: ${error.message}`, 500);
  }
  if (!data) {
    return jsonError("app_config missing", 500);
  }

  const verificationConfig = normalizeVerificationConfig(data.verification_config);
  const enrichmentConfig = normalizeEnrichmentConfig(
    (data as { enrichment_config?: unknown }).enrichment_config,
  );

  return jsonOk({
    autoVerifyAiCall: verificationConfig.autoVerifyAiCall,
    autoVerifyAiEmail: verificationConfig.autoVerifyAiEmail,
    ...enrichmentConfig,
    enrichmentTriggersMeta: enrichmentTriggersMeta(),
    enrichmentTriggers: normalizeEnrichmentTriggers(
      (data as { enrichment_triggers?: unknown }).enrichment_triggers ?? null,
    ),
    updatedAt: data.updated_at,
  });
});
