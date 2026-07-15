"use server";

import { efResult, type EfResult } from "@/lib/supabase-ef";

// ─── Settings read ─────────────────────────────────────────────────────────

export type SynthesisQuality = "economy" | "standard" | "high";

// Perplexity Agent preset — the "search model" for the Enricher's S2 (SERP
// summary) + S3 (channel link discovery). Mirrors the Perplexity Agent API
// preset names (docs.perplexity.ai/docs/agent-api/presets).
export type PerplexityPreset =
  | "fast-search"
  | "pro-search"
  | "deep-research"
  | "advanced-deep-research";

// The Enricher's pipeline knobs, echoed identically by both EFs below. Shared
// ADDITIVELY (never `Omit<>` off the settings shape): subtracting by exclusion
// would silently admit any future non-atlas settings key into the config echo,
// which is the same drift in the other direction. A knob belongs here only if
// BOTH endpoints return it.
type AtlasKnobs = {
  atlasGatherGoogleImages: number;
  atlasGatherInstagramDepth: number;
  atlasGatherInstagramPosts: number;
  atlasGatherReviews: number;
  atlasImageVisionEnabled: boolean;
  atlasAnalyzeGoogleImages: number;
  atlasImageAnalysisPrompt: string;
  atlasImageSortingPrompt: string;
  atlasAnalyzeInstagramImages: number;
  atlasSaveTotalImages: number;
  atlasSaveImagesToStorage: boolean;
  atlasSynthesisQuality: SynthesisQuality;
  atlasVisionQuality: SynthesisQuality;
  atlasPerplexityPreset: PerplexityPreset;
  atlasPerRunCostCapUsd: number;
  atlasDiscoverWebsiteN: number;
  atlasDiscoverInstagramN: number;
  atlasDiscoverFacebookN: number;
  atlasDiscoverOpentableN: number;
  atlasDiscoverUbereatsN: number;
};

type SettingsResponse = AtlasKnobs & {
  autoVerifyAiCall: boolean;
  autoVerifyAiEmail: boolean;
  autoVerifyVideo: boolean;
  updatedAt: string | null;
};

export async function getAtlasSettings(): Promise<EfResult<SettingsResponse>> {
  return efResult<SettingsResponse>("admin-web-get-settings", {});
}

// ─── Enricher pipeline config ──────────────────────────────────────────────

// The echo every section re-seeds its fields from: the EF is the authority on
// what a knob actually ended up as, so it returns the whole knob block on every
// partial update, not just the keys that were sent.
export type AtlasConfigResponse = AtlasKnobs & {
  updatedAt: string | null;
};

/** The knobs a section may write — every key optional, mirroring AtlasKnobs. */
export type AtlasConfigPatch = {
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
  synthesisQuality?: SynthesisQuality;
  visionQuality?: SynthesisQuality;
  perplexityPreset?: PerplexityPreset;
  perRunCostCapUsd?: number;
  discoverWebsiteN?: number;
  discoverInstagramN?: number;
  discoverFacebookN?: number;
  discoverOpentableN?: number;
  discoverUbereatsN?: number;
};

// Partial update — pass only the fields you want to change.
export async function updateAtlasConfig(
  patch: AtlasConfigPatch,
): Promise<EfResult<AtlasConfigResponse>> {
  return efResult<AtlasConfigResponse>("admin-web-update-atlas-config", patch);
}
