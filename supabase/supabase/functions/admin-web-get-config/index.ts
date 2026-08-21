// Supabase Edge Function — admin-web-get-config
//
// Returns the full public.app_config singleton row to the admin web.
// One central read for every admin page that needs to surface a flag:
//
//   auto_verify_ai_call         — verification auto-approve (call OTP)
//   auto_verify_ai_email        — verification auto-approve (email OTP)
//   auto_verify_video           — verification auto-approve (legacy video)
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
      "auto_verify_ai_call, auto_verify_ai_email, auto_verify_video, atlas_gather_google_images, atlas_gather_instagram_depth, atlas_gather_instagram_posts, atlas_gather_reviews, atlas_image_vision_enabled, atlas_analyze_google_images, atlas_analyze_instagram_images, atlas_save_total_images, atlas_save_images_to_storage, atlas_image_analysis_prompt, atlas_image_sorting_prompt, atlas_synthesis_quality, atlas_vision_quality, atlas_perplexity_preset, atlas_per_run_cost_cap_usd, atlas_discover_website_n, atlas_discover_instagram_n, atlas_discover_facebook_n, atlas_discover_opentable_n, atlas_discover_ubereats_n, enrichment_triggers, updated_at",
    )
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    return jsonError(`settings_read: ${error.message}`, 500);
  }
  if (!data) {
    return jsonError("app_config missing", 500);
  }

  return jsonOk({
    autoVerifyAiCall: data.auto_verify_ai_call,
    autoVerifyAiEmail: data.auto_verify_ai_email,
    autoVerifyVideo: data.auto_verify_video,
    atlasGatherGoogleImages: data.atlas_gather_google_images,
    atlasGatherInstagramDepth: data.atlas_gather_instagram_depth,
    atlasGatherInstagramPosts: data.atlas_gather_instagram_posts,
    atlasGatherReviews: data.atlas_gather_reviews,
    atlasImageVisionEnabled: data.atlas_image_vision_enabled,
    atlasAnalyzeGoogleImages: data.atlas_analyze_google_images,
    atlasAnalyzeInstagramImages: data.atlas_analyze_instagram_images,
    atlasSaveTotalImages: data.atlas_save_total_images,
    atlasSaveImagesToStorage: data.atlas_save_images_to_storage,
    atlasImageAnalysisPrompt: data.atlas_image_analysis_prompt,
    atlasImageSortingPrompt: data.atlas_image_sorting_prompt,
    atlasSynthesisQuality: data.atlas_synthesis_quality,
    atlasVisionQuality: data.atlas_vision_quality,
    atlasPerplexityPreset: data.atlas_perplexity_preset,
    atlasPerRunCostCapUsd: data.atlas_per_run_cost_cap_usd,
    atlasDiscoverWebsiteN: data.atlas_discover_website_n,
    atlasDiscoverInstagramN: data.atlas_discover_instagram_n,
    atlasDiscoverFacebookN: data.atlas_discover_facebook_n,
    atlasDiscoverOpentableN: data.atlas_discover_opentable_n,
    atlasDiscoverUbereatsN: data.atlas_discover_ubereats_n,
    enrichmentTriggersMeta: enrichmentTriggersMeta(),
    enrichmentTriggers: normalizeEnrichmentTriggers(
      (data as { enrichment_triggers?: unknown }).enrichment_triggers ?? null,
    ),
    updatedAt: data.updated_at,
  });
});
