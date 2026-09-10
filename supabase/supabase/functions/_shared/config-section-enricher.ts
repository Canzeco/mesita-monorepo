// _shared/config-section-enricher.ts — the `enricher` section's write.
//
// Was admin-web-update-enricher-config (MESITA-1724 collapse). Partial-update
// of the Intaker research knobs on app_config.enrichment_config (MESITA-1248
// fold of the leftover atlas_* scalars), written from the admin console's
// Intake → Configuration page. Each field is optional; only the keys present in
// the body are merged, so the UI can save one control at a time — which is why
// this section owns its write instead of riding the generic whole-blob path.
// The knobs arrive FLAT on the body, not under `config`.
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
// READ-MERGE-WRITE of the jsonb (same lost-update accept as verification: one
// super-admin). enrichment_triggers stays its own column, and this is the one
// section whose write touches two.
//
// There is deliberately no `enricher` READ override: admin-web-get-config's
// no-section payload is what the Intake page loads, and it returns
// enrichment_config, enrichment_triggers and their meta together.
import { jsonError, jsonOk } from "./http.ts";
import { readAppConfig, writeAppConfig } from "./write-config.ts";
import type { ConfigSection, SectionWriteContext } from "./config-section-base.ts";
import { normalizeEnrichmentTriggers } from "./enrich-triggers.ts";
import { ENRICH_FIELD_LIMITS } from "./enrich-field-limits.ts";
import { normalizeEnrichmentConfig } from "./enrichment-config.ts";
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
  requestThreshold?: number;
};

const QUALITY_VALUES = new Set(["economy", "standard", "high"]);
const PERPLEXITY_PRESETS = new Set([
  "fast-search",
  "pro-search",
  "deep-research",
  "advanced-deep-research",
]);

export async function writeEnricherSection(
  ctx: SectionWriteContext,
  section: ConfigSection,
): Promise<Response> {
  const body = ctx.body as Body;

  const current = await readAppConfig(
    ctx.admin,
    section.column,
    `${section.column}_read`,
  );
  if (!current.ok) return current.response;

  const next = normalizeEnrichmentConfig(current.row?.[section.column]);
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

  if (body.requestThreshold !== undefined) {
    const n = intInRange(body.requestThreshold, 1, 100);
    if (n === null) return jsonError("requestThreshold must be an integer 1-100", 400);
    next.atlasRequestThreshold = n;
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

  const patch: Record<string, unknown> = { updated_by: ctx.userId };
  if (blobTouched) patch[section.column] = next;
  if (triggers !== undefined) patch.enrichment_triggers = triggers;

  const saved = await writeAppConfig(
    ctx.admin,
    patch,
    `${section.column}, enrichment_triggers, updated_at`,
    "settings_update",
  );
  if (!saved.ok) return saved.response;

  return jsonOk({
    enrichmentTriggers: normalizeEnrichmentTriggers(
      saved.row.enrichment_triggers ?? null,
    ),
    ...normalizeEnrichmentConfig(saved.row[section.column]),
    updatedAt: saved.row.updated_at,
  });
}
