// Enricher pipeline: run-time config + shared types.
//
// Every knob lives in app_config.enrichment_config (MESITA-1248 fold of the
// leftover atlas_* scalars) and is read at run time — the DB is the single
// source of truth; callers never pass overrides.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { DEFAULT_MODELS_CONFIG } from "./models-config.ts";
import { normalizeEnrichmentConfig } from "./enrichment-config.ts";
import { ENRICH_FIELD_LIMITS } from "./enrich-field-limits.ts";

export const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

// Vision + sort always run on the cheap multimodal model — image work doesn't
// need the synthesis-quality setting (which governs only the profile text model).
/** Default vision/sort model when models_config.enricher.model is unavailable. */
export const VISION_MODEL = DEFAULT_MODELS_CONFIG.enricher.model;

// Synthesis model by the admin 'synthesis quality' param. Synthesis reads only
// the gathered source material (no web) — that's why it's OpenAI, not Perplexity
// (which would re-search and drift). Two tiers (MESITA-2126): the third, 'high',
// ran the same gpt-4o as 'standard', so it was retired; a stored 'high' is read
// as 'standard' (enrichment-config.ts). Literals, not VISION_MODEL, because the
// admin Models page pins its ENRICHER_TIER_MODELS copy to these strings from
// both packages (enrich-tiers.test.ts here, lib/synthesis-quality.test.ts there).
export const QUALITY_MODEL: Record<string, string> = {
  economy: "gpt-4o-mini",
  standard: "gpt-4o",
};

// Resolve the per-image vision model from the admin 'Image model' knob
// (same economy/standard scale as synthesis).
export function visionModelFor(quality: string): string {
  return QUALITY_MODEL[quality] ?? VISION_MODEL;
}

// Presentation ceiling (ENRICH_FIELD_LIMITS.description) and the length the
// Description step asks for (MESITA-2955, Pato: "around 1500 chars"). The
// target sits 500 under the ceiling so a long reply still fits and the cap
// rarely cuts a sentence. 1,500 characters is about 250 words.
export const ENRICH_DESCRIPTION_MAX = ENRICH_FIELD_LIMITS.description.max;
export const ENRICH_DESCRIPTION_TARGET_CHARS = 1500;
export const ENRICH_DESCRIPTION_TARGET_WORDS = 250;

export type EnrichConfig = {
  synthesisQuality: string;
  // Admin "Image model" knob — which model DESCRIBES photos (S5). The text
  // sort (S6) and utility judges stay on the cheap VISION_MODEL, matching the
  // admin cost calculator's lines.
  visionQuality: string;
  // Admin "Search model" knob — the Perplexity Agent PRESET used for S2 (SERP
  // summary) and S3 (channel discovery / link validation). Bundles model + step
  // budget + search depth; fast-search | pro-search | deep-research |
  // advanced-deep-research (default pro-search).
  perplexityPreset: string;
  // GATHER caps — how many to PULL per source before anything else.
  gatherGoogleImages: number;
  // Instagram: DEPTH = newest posts pulled. POSTS (likes-keep) follows vision Y
  // from Crenup (≤ depth). Google photos already come best-first — no likes step.
  gatherInstagramDepth: number;
  gatherInstagramPosts: number;
  // How many Google reviews the Apify Maps scrape pulls (0–googleReviews.max),
  // for synthesis grounding. Hard ceiling = ENRICH_FIELD_LIMITS.googleReviews.
  gatherReviews: number;
  // Per-source Firecrawl Search candidate counts for link discovery (S4).
  // Keyed by ChannelField-ish source name; 0 disables a source.
  discoverCandidates: {
    website_url: number;
    instagram_url: number;
    facebook_url: number;
    opentable_url: number;
    uber_eats_url: number;
  };
  // SAVE cap — final count persisted, SOURCE-INDEPENDENT, after analyze + sort.
  saveTotalImages: number;
  // S9 gate — mirror the selected gallery into Supabase Storage. When false the
  // pipeline skips the upload and photos render from their source URLs only.
  saveImagesToStorage: boolean;
  visionEnabled: boolean;
  // ANALYZE caps — how many gathered images per source go to vision.
  analyzeGoogleImages: number;
  analyzeInstagramImages: number;
  imageAnalysisPrompt: string;
  imageSortingPrompt: string;
};

// Read the Crenup admin knobs from app_config.enrichment_config (row id=1).
// The select is a single string LITERAL on purpose: supabase-js infers the
// row type only from a literal argument — anything that widens to `string`
// falls back to GenericStringError.
export async function loadEnrichConfig(admin: SupabaseClient): Promise<EnrichConfig> {
  const { data: cfg } = await admin
    .from("app_config")
    .select("enrichment_config")
    .eq("id", 1)
    .maybeSingle();

  const blob = normalizeEnrichmentConfig(
    (cfg as { enrichment_config?: unknown } | null)?.enrichment_config,
  );

  return {
    synthesisQuality: blob.enrichSynthesisQuality,
    visionQuality: blob.enrichVisionQuality,
    perplexityPreset: blob.enrichPerplexityPreset,
    gatherGoogleImages: blob.enrichGatherGoogleImages,
    gatherInstagramDepth: blob.enrichGatherInstagramDepth,
    gatherInstagramPosts: blob.enrichGatherInstagramPosts,
    gatherReviews: blob.enrichGatherReviews,
    discoverCandidates: {
      website_url: blob.enrichDiscoverWebsiteN,
      instagram_url: blob.enrichDiscoverInstagramN,
      facebook_url: blob.enrichDiscoverFacebookN,
      opentable_url: blob.enrichDiscoverOpentableN,
      uber_eats_url: blob.enrichDiscoverUbereatsN,
    },
    saveTotalImages: blob.enrichSaveTotalImages,
    saveImagesToStorage: blob.enrichSaveImagesToStorage,
    visionEnabled: blob.enrichImageVisionEnabled,
    analyzeGoogleImages: blob.enrichAnalyzeGoogleImages,
    analyzeInstagramImages: blob.enrichAnalyzeInstagramImages,
    imageAnalysisPrompt: blob.enrichImageAnalysisPrompt,
    imageSortingPrompt: blob.enrichImageSortingPrompt,
  };
}
