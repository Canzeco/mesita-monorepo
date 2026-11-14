import type { SynthesisQuality } from "@/lib/synthesis-quality";
import type { PerplexityPreset } from "./actions";

// Image-funnel ceilings the EF already CHECKs. The page clamps so a Save
// never 400s on a broken chain (analyze > collect, gallery > analyzed).
export const MAX_GOOGLE_COLLECT = 10;
export const MAX_INSTAGRAM_COLLECT = 30;
export const MAX_SAVE_IMAGES = 10; // DB CHECK app_config_atlas_save_total_images_range

export type CrenupSettings = {
  gatherGoogleImages: number;
  gatherInstagramDepth: number;
  gatherReviews: number;
  imageVisionEnabled: boolean;
  saveImagesToStorage: boolean;
  saveTotalImages: number;
  analyzeGoogleImages: number;
  analyzeInstagramImages: number;
  imageAnalysisPrompt: string;
  imageSortingPrompt: string;
  synthesisQuality: SynthesisQuality;
  visionQuality: SynthesisQuality;
  perplexityPreset: PerplexityPreset;
  discoverWebsiteN: number;
  discoverInstagramN: number;
  discoverFacebookN: number;
  discoverOpentableN: number;
  discoverUbereatsN: number;
  requestThreshold: number;
  /** Create the profile on open — one switch per app (MESITA-2298). */
  createOnOpenConsumer: boolean;
  createOnOpenAdmin: boolean;
  /** Places one guest may create per rolling 24 h (MESITA-2376). */
  consumerCreatesPerDay: number;
  /** Fast Update: first after N, then every M views (MESITA-3934). */
  updateFirstAfterViews: number;
  updateEveryViews: number;
  /** Deep Update: first after N, then every M views. */
  reviewsUpdateFirstAfterViews: number;
  reviewsUpdateEveryViews: number;
  /** Deep Enrich then every M views (its first-after is requestThreshold). */
  enrichEveryViews: number;
};

const clampN = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Math.round(v)));

export function clampFunnel(s: CrenupSettings): CrenupSettings {
  const gatherGoogleImages = clampN(s.gatherGoogleImages, 1, MAX_GOOGLE_COLLECT);
  const gatherInstagramDepth = clampN(
    s.gatherInstagramDepth,
    1,
    MAX_INSTAGRAM_COLLECT,
  );
  const analyzeGoogleImages = clampN(
    s.analyzeGoogleImages,
    1,
    gatherGoogleImages,
  );
  const analyzeInstagramImages = clampN(
    s.analyzeInstagramImages,
    1,
    gatherInstagramDepth,
  );
  return {
    ...s,
    gatherGoogleImages,
    gatherInstagramDepth,
    analyzeGoogleImages,
    analyzeInstagramImages,
    saveTotalImages: clampN(
      s.saveTotalImages,
      1,
      Math.min(MAX_SAVE_IMAGES, analyzeGoogleImages + analyzeInstagramImages),
    ),
    requestThreshold: clampN(s.requestThreshold, 1, 100),
  };
}

/**
 * What one Save sends (MESITA-3939). Pure, so its exact keys are pinned by a
 * test: a live enrichment_config write. Model tiers (synthesisQuality,
 * visionQuality, perplexityPreset) are Models' and never sent from here.
 * `gatherInstagramPosts` mirrors the analyzed-Instagram count, as before.
 */
export function savePayload(s: CrenupSettings) {
  return {
    gatherGoogleImages: s.gatherGoogleImages,
    gatherInstagramDepth: s.gatherInstagramDepth,
    gatherInstagramPosts: s.analyzeInstagramImages,
    gatherReviews: s.gatherReviews,
    imageVisionEnabled: s.imageVisionEnabled,
    saveImagesToStorage: s.saveImagesToStorage,
    saveTotalImages: s.saveTotalImages,
    analyzeGoogleImages: s.analyzeGoogleImages,
    analyzeInstagramImages: s.analyzeInstagramImages,
    imageAnalysisPrompt: s.imageAnalysisPrompt,
    imageSortingPrompt: s.imageSortingPrompt,
    discoverWebsiteN: s.discoverWebsiteN,
    discoverInstagramN: s.discoverInstagramN,
    discoverFacebookN: s.discoverFacebookN,
    discoverOpentableN: s.discoverOpentableN,
    discoverUbereatsN: s.discoverUbereatsN,
    requestThreshold: s.requestThreshold,
    createOnOpenConsumer: s.createOnOpenConsumer,
    createOnOpenAdmin: s.createOnOpenAdmin,
    consumerCreatesPerDay: s.consumerCreatesPerDay,
    updateEveryViews: s.updateEveryViews,
    reviewsUpdateEveryViews: s.reviewsUpdateEveryViews,
    updateFirstAfterViews: s.updateFirstAfterViews,
    reviewsUpdateFirstAfterViews: s.reviewsUpdateFirstAfterViews,
    enrichEveryViews: s.enrichEveryViews,
  };
}
