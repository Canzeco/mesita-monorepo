// Supabase Edge Function — admin-web-get-config
//
// THE admin config read. Two behaviours, one door (MESITA-1724, which folded
// nine per-page getters in here):
//
//   { }                  the Intake payload below — verification flags,
//                        enrichment config, triggers, and the two read-only
//                        meta blocks. Unchanged, and deliberately NOT a
//                        section: there is no admin-web-get-enricher-config
//                        because this IS the Intake page's load.
//   { section: "<key>" } one section of public.app_config —
//                        { ok, config, updatedAt }, per
//                        _shared/config-sections.ts.
//
// The Intake payload's flags:
//   autoVerifyAiCall  — verification auto-approve (call OTP)
//   autoVerifyAiEmail — verification auto-approve (email OTP)
//   (both live in the verification_config jsonb column, MESITA-1248 fold)
//
// `auto_verify_video`/`autoVerifyVideo` retired (MESITA-1248) — nothing ever
// read it; see _shared/config-section-verification.ts for the full finding.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  jsonError,
  jsonOk,
  readJsonOr,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { readConfigSection } from "../_shared/config-sections.ts";
import {
  enrichmentTriggersMeta,
  normalizeEnrichmentTriggers,
} from "../_shared/enrich-triggers.ts";
import { normalizeEnrichmentConfig } from "../_shared/enrichment-config.ts";
import { intakePromptsMeta } from "../_shared/intake-prompts.ts";
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

  // Body is OPTIONAL: the Intake page has always posted `{}`, and an absent or
  // unparseable body must keep meaning "the whole payload", not a 400.
  const body = await readJsonOr<{ section?: unknown }>(req, {});
  const key = typeof body.section === "string" ? body.section.trim() : "";
  if (key) return await readConfigSection(admin, key);

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
    // Read-only: the prompts the Intaker actually sends, imported from the same
    // constants the pipeline calls. The console renders these; it keeps no copy.
    intakePromptsMeta: intakePromptsMeta(),
    enrichmentTriggers: normalizeEnrichmentTriggers(
      (data as { enrichment_triggers?: unknown }).enrichment_triggers ?? null,
    ),
    updatedAt: data.updated_at,
  });
});
