// Supabase Edge Function — admin-web-get-config
//
// THE admin config read. Two behaviours, one door (MESITA-1724, which folded
// nine per-page getters in here):
//
//   { }                  the Crenup payload below — enrichment config,
//                        triggers, and the two read-only
//                        meta blocks. Unchanged, and deliberately NOT a
//                        section: there is no admin-web-get-enricher-config
//                        because this IS the Crenup page's load.
//   { section: "<key>" } one section of public.app_config —
//                        { ok, config, updatedAt }, per
//                        _shared/config-sections.ts.
//
// The payload carried autoVerifyAiCall / autoVerifyAiEmail until MESITA-2106:
// the MVP has no business app, so no one proves ownership and the Creation
// page lost its Verification card.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  jsonError,
  jsonOk,
  readJsonOr,
  rejectUnlessMethods,
  serveJson,
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
import { crenupPromptsMeta } from "../_shared/crenup-prompts.ts";

serveJson("admin-web-get-config", async (req) => {
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

  // Body is OPTIONAL: the Crenup page has always posted `{}`, and an absent or
  // unparseable body must keep meaning "the whole payload", not a 400.
  const body = await readJsonOr<{ section?: unknown }>(req, {});
  const key = typeof body.section === "string" ? body.section.trim() : "";
  if (key) return await readConfigSection(admin, key);

  const { data, error } = await admin
    .from("app_config")
    .select(
      "enrichment_config, enrichment_triggers, updated_at",
    )
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    return jsonError(`settings_read: ${error.message}`, 500);
  }
  if (!data) {
    return jsonError("app_config missing", 500);
  }

  const enrichmentConfig = normalizeEnrichmentConfig(
    (data as { enrichment_config?: unknown }).enrichment_config,
  );

  return jsonOk({
    ...enrichmentConfig,
    enrichmentTriggersMeta: enrichmentTriggersMeta(),
    // Read-only: the prompts the Enricher actually sends, imported from the same
    // constants the pipeline calls. The console renders these; it keeps no copy.
    crenupPromptsMeta: crenupPromptsMeta(),
    enrichmentTriggers: normalizeEnrichmentTriggers(
      (data as { enrichment_triggers?: unknown }).enrichment_triggers ?? null,
    ),
    updatedAt: data.updated_at,
  });
});
