import type { PerplexityPreset, SynthesisQuality } from "./actions";

// Image-funnel ceilings the EF already CHECKs. The page clamps so a Save
// never 400s on a broken chain (analyze > collect, gallery > analyzed).
export const MAX_GOOGLE_COLLECT = 10;
export const MAX_INSTAGRAM_COLLECT = 30;
export const MAX_SAVE_IMAGES = 10; // DB CHECK app_config_atlas_save_total_images_range

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

/** Either GET failing disables the one Save — defaults must not overwrite live. */
export function intakeSaveBlocked(
  sourcingLoadError: string | null,
  settingsLoadError: string | null,
): string | null {
  return sourcingLoadError ?? settingsLoadError;
}

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
