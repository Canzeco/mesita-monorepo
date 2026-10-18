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
