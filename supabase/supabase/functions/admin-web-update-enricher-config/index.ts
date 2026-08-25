// Supabase Edge Function — admin-web-update-enricher-config
//
// Naming: caller-verb-words. Caller = admin, verb = update, words = enricher-config.
//
// Partial-update of the Intaker research knobs on public.app_config.enrichment_config
// (MESITA-1248 fold of the leftover atlas_* scalars), written from the admin
// console's Intake → Configuration page. Each field is optional; only the keys
// present in the body are merged, so the UI can save one control at a time.
//
//   gatherGoogleImages (1–10)
//   gatherInstagramDepth (1–30, download) / gatherInstagramPosts (1–30, keep ≤ depth)
//   gatherReviews (0–100)
//   analyzeGoogleImages (1–10, ≤ gatherGoogleImages) /
//     analyzeInstagramImages (1–30, ≤ gatherInstagramPosts)
//   saveTotalImages (1–10, ≤ analyzeGoogle + analyzeInstagram)
//   saveImagesToStorage (boolean)
//   discover{Website,Instagram,Facebook,Opentable,Ubereats}N (0–10)
//   imageAnalysisPrompt / imageSortingPrompt
//
// READ-MERGE-WRITE of the jsonb (same lost-update accept as verification_config:
// one super-admin). enrichment_triggers stays its own column.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, jsonError, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { normalizeEnrichmentTriggers } from "../_shared/enrich-triggers.ts";
import { ENRICH_FIELD_LIMITS } from "../_shared/enrich-field-limits.ts";
import {
  normalizeEnrichmentConfig,
} from "../_shared/enrichment-config.ts";
import { funnelLockError, intInRange } from "./atlas-config-validate.ts";

const GOOGLE_REVIEWS_MAX = ENRICH_FIELD_LIMITS.googleReviews.max;
const INSTAGRAM_MAX = 30;
const SAVE_TOTAL_IMAGES_MAX = ENRICH_FIELD_LIMITS.photos.max;

type Body = {
  enrichmentTriggers?: unknown;
  gatherGoogleImages?: number;
  gatherInstagramDepth?: number;
  gatherInstagramPosts?: number;
  gatherReviews?: number;
  imageVisionEnabled?: boolean;
  analyzeGoogleImages?: number;
  analyzeInstagramImages?: number;
  saveTotalImages?: number;
  saveImagesToStorage?: boolean;
  imageAnalysisPrompt?: string;
  imageSortingPrompt?: string;
  synthesisQuality?: string;
  visionQuality?: string;
  perplexityPreset?: string;
  perRunCostCapUsd?: number;
  discoverWebsiteN?: number;
  discoverInstagramN?: number;
  discoverFacebookN?: number;
  discoverOpentableN?: number;
  discoverUbereatsN?: number;
};

const QUALITY_VALUES = new Set(["economy", "standard", "high"]);
const PERPLEXITY_PRESETS = new Set([
  "fast-search",
  "pro-search",
  "deep-research",
  "advanced-deep-research",
]);

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
  const body = bodyRes.body;

  const { data: current, error: readError } = await admin
    .from("app_config")
    .select("enrichment_config")
    .eq("id", 1)
    .maybeSingle();
  if (readError) {
    return jsonError(`enrichment_config_read: ${readError.message}`, 500);
  }

  const next = normalizeEnrichmentConfig(
    (current as { enrichment_config?: unknown } | null)?.enrichment_config,
  );
  let funnelTouched = false;
  let blobTouched = false;
  let triggers: unknown | undefined;

  if (body.gatherGoogleImages !== undefined) {
    const n = intInRange(body.gatherGoogleImages, 1, 10);
    if (n === null) return jsonError("gatherGoogleImages must be an integer 1-10", 400);
    next.atlasGatherGoogleImages = n;
    funnelTouched = true;
    blobTouched = true;
  }

  if (body.gatherInstagramDepth !== undefined) {
    const n = intInRange(body.gatherInstagramDepth, 1, INSTAGRAM_MAX);
    if (n === null) {
      return jsonError(`gatherInstagramDepth must be an integer 1-${INSTAGRAM_MAX}`, 400);
    }
    next.atlasGatherInstagramDepth = n;
    funnelTouched = true;
    blobTouched = true;
  }

  if (body.gatherInstagramPosts !== undefined) {
    const n = intInRange(body.gatherInstagramPosts, 1, INSTAGRAM_MAX);
    if (n === null) {
      return jsonError(`gatherInstagramPosts must be an integer 1-${INSTAGRAM_MAX}`, 400);
    }
    next.atlasGatherInstagramPosts = n;
    funnelTouched = true;
    blobTouched = true;
  }

  if (body.gatherReviews !== undefined) {
    const n = intInRange(body.gatherReviews, 0, GOOGLE_REVIEWS_MAX);
    if (n === null) {
      return jsonError(`gatherReviews must be an integer 0-${GOOGLE_REVIEWS_MAX}`, 400);
    }
    next.atlasGatherReviews = n;
    blobTouched = true;
  }

  if (body.imageVisionEnabled !== undefined) {
    if (typeof body.imageVisionEnabled !== "boolean") {
      return jsonError("imageVisionEnabled must be a boolean", 400);
    }
    next.atlasImageVisionEnabled = body.imageVisionEnabled;
    blobTouched = true;
  }

  if (body.saveTotalImages !== undefined) {
    const n = intInRange(body.saveTotalImages, 1, SAVE_TOTAL_IMAGES_MAX);
    if (n === null) {
      return jsonError(`saveTotalImages must be an integer 1-${SAVE_TOTAL_IMAGES_MAX}`, 400);
    }
    next.atlasSaveTotalImages = n;
    funnelTouched = true;
    blobTouched = true;
  }

  if (body.saveImagesToStorage !== undefined) {
    if (typeof body.saveImagesToStorage !== "boolean") {
      return jsonError("saveImagesToStorage must be a boolean", 400);
    }
    next.atlasSaveImagesToStorage = body.saveImagesToStorage;
    blobTouched = true;
  }

  if (body.analyzeGoogleImages !== undefined) {
    const n = intInRange(body.analyzeGoogleImages, 1, 10);
    if (n === null) return jsonError("analyzeGoogleImages must be an integer 1-10", 400);
    next.atlasAnalyzeGoogleImages = n;
    funnelTouched = true;
    blobTouched = true;
  }

  if (body.imageAnalysisPrompt !== undefined) {
    if (typeof body.imageAnalysisPrompt !== "string" || body.imageAnalysisPrompt.length > 4000) {
      return jsonError("imageAnalysisPrompt must be a string up to 4000 chars", 400);
    }
    next.atlasImageAnalysisPrompt = body.imageAnalysisPrompt;
    blobTouched = true;
  }

  if (body.imageSortingPrompt !== undefined) {
    if (typeof body.imageSortingPrompt !== "string" || body.imageSortingPrompt.length > 4000) {
      return jsonError("imageSortingPrompt must be a string up to 4000 chars", 400);
    }
    next.atlasImageSortingPrompt = body.imageSortingPrompt;
    blobTouched = true;
  }

  if (body.analyzeInstagramImages !== undefined) {
    const n = intInRange(body.analyzeInstagramImages, 1, INSTAGRAM_MAX);
    if (n === null) {
      return jsonError(`analyzeInstagramImages must be an integer 1-${INSTAGRAM_MAX}`, 400);
    }
    next.atlasAnalyzeInstagramImages = n;
    funnelTouched = true;
    blobTouched = true;
  }

  if (body.synthesisQuality !== undefined) {
    if (typeof body.synthesisQuality !== "string" || !QUALITY_VALUES.has(body.synthesisQuality)) {
      return jsonError("synthesisQuality must be economy, standard, or high", 400);
    }
    next.atlasSynthesisQuality = body.synthesisQuality;
    blobTouched = true;
  }

  if (body.visionQuality !== undefined) {
    if (typeof body.visionQuality !== "string" || !QUALITY_VALUES.has(body.visionQuality)) {
      return jsonError("visionQuality must be economy, standard, or high", 400);
    }
    next.atlasVisionQuality = body.visionQuality;
    blobTouched = true;
  }

  if (body.perplexityPreset !== undefined) {
    if (
      typeof body.perplexityPreset !== "string" ||
      !PERPLEXITY_PRESETS.has(body.perplexityPreset)
    ) {
      return jsonError(
        "perplexityPreset must be fast-search, pro-search, deep-research, or advanced-deep-research",
        400,
      );
    }
    next.atlasPerplexityPreset = body.perplexityPreset;
    blobTouched = true;
  }

  if (body.perRunCostCapUsd !== undefined) {
    if (typeof body.perRunCostCapUsd !== "number" || body.perRunCostCapUsd < 0) {
      return jsonError("perRunCostCapUsd must be a number >= 0", 400);
    }
    next.atlasPerRunCostCapUsd = Math.round(body.perRunCostCapUsd * 100) / 100;
    blobTouched = true;
  }

  if (body.discoverWebsiteN !== undefined) {
    const n = intInRange(body.discoverWebsiteN, 0, 10);
    if (n === null) return jsonError("discoverWebsiteN must be an integer 0-10", 400);
    next.atlasDiscoverWebsiteN = n;
    blobTouched = true;
  }
  if (body.discoverInstagramN !== undefined) {
    const n = intInRange(body.discoverInstagramN, 0, 10);
    if (n === null) return jsonError("discoverInstagramN must be an integer 0-10", 400);
    next.atlasDiscoverInstagramN = n;
    blobTouched = true;
  }
  if (body.discoverFacebookN !== undefined) {
    const n = intInRange(body.discoverFacebookN, 0, 10);
    if (n === null) return jsonError("discoverFacebookN must be an integer 0-10", 400);
    next.atlasDiscoverFacebookN = n;
    blobTouched = true;
  }
  if (body.discoverOpentableN !== undefined) {
    const n = intInRange(body.discoverOpentableN, 0, 10);
    if (n === null) return jsonError("discoverOpentableN must be an integer 0-10", 400);
    next.atlasDiscoverOpentableN = n;
    blobTouched = true;
  }
  if (body.discoverUbereatsN !== undefined) {
    const n = intInRange(body.discoverUbereatsN, 0, 10);
    if (n === null) return jsonError("discoverUbereatsN must be an integer 0-10", 400);
    next.atlasDiscoverUbereatsN = n;
    blobTouched = true;
  }

  if (funnelTouched) {
    const lockErr = funnelLockError(
      next.atlasGatherGoogleImages,
      next.atlasGatherInstagramDepth,
      next.atlasGatherInstagramPosts,
      next.atlasAnalyzeGoogleImages,
      next.atlasAnalyzeInstagramImages,
      next.atlasSaveTotalImages,
    );
    if (lockErr) return jsonError(lockErr, 400);
  }

  if (body.enrichmentTriggers !== undefined) {
    if (body.enrichmentTriggers === null || typeof body.enrichmentTriggers !== "object") {
      return jsonError("enrichmentTriggers must be an object", 400);
    }
    triggers = normalizeEnrichmentTriggers(body.enrichmentTriggers);
  }

  if (!blobTouched && triggers === undefined) {
    return jsonError("Nothing to update", 400);
  }

  const patch: Record<string, unknown> = { updated_by: userId };
  if (blobTouched) patch.enrichment_config = next;
  if (triggers !== undefined) patch.enrichment_triggers = triggers;

  const { data, error } = await admin
    .from("app_config")
    .update(patch)
    .eq("id", 1)
    .select("enrichment_config, enrichment_triggers, updated_at")
    .single();
  if (error) {
    return jsonError(`settings_update: ${error.message}`, 500);
  }

  const saved = normalizeEnrichmentConfig(
    (data as { enrichment_config?: unknown }).enrichment_config,
  );
  return json({
    ok: true,
    enrichmentTriggers: normalizeEnrichmentTriggers(
      (data as { enrichment_triggers?: unknown }).enrichment_triggers ?? null,
    ),
    ...saved,
    updatedAt: data.updated_at,
  });
});
