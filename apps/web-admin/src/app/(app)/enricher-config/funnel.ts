import type { PerplexityPreset, SynthesisQuality } from "./actions";

// Image-funnel clamps. The Edge Function rejects a broken chain with a 400,
// so the page keeps analyze ≤ collect per source and the gallery ≤ everything
// analyzed. Pure so the UI and the unit tests share one function.
//
// Instagram collect (`gatherInstagramDepth`) is an Images knob, not a Social
// one. Social attaches profiles; Images collects posts from Apify and analyzes.

export const MAX_GOOGLE_COLLECT = 10;
export const MAX_INSTAGRAM_COLLECT = 30;
export const MAX_SAVE_IMAGES = 10; // DB CHECK app_config_atlas_save_total_images_range
export const MAX_DISCOVERY_CANDIDATES = 10;

export type IntakeSettings = {
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
  perRunCostCapUsd: number;
  discoverWebsiteN: number;
  discoverInstagramN: number;
  discoverFacebookN: number;
  discoverOpentableN: number;
  discoverUbereatsN: number;
};

const clampN = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Math.round(v)));

export function clampFunnel(s: IntakeSettings): IntakeSettings {
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
  };
}
