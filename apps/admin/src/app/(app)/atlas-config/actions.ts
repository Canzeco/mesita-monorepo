"use server";

import { efInvoke } from "@/lib/supabase-ef";

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

type SettingsResponse = {
  autoVerifyAiCall: boolean;
  autoVerifyAiEmail: boolean;
  autoVerifyVideo: boolean;
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
  updatedAt: string | null;
};

type GetSettingsResult =
  | { ok: true; data: SettingsResponse }
  | { ok: false; error: string };

export async function getAtlasSettings(): Promise<GetSettingsResult> {
  const r = await efInvoke<SettingsResponse>("admin-web-get-settings", {});
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

// ─── Atlas research config ─────────────────────────────────────────────────

type AtlasConfigResponse = {
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
  updatedAt: string | null;
};

type UpdateAtlasConfigResult =
  | { ok: true; data: AtlasConfigResponse }
  | { ok: false; error: string };

// Partial update — pass only the fields you want to change.
export async function updateAtlasConfig(patch: {
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
}): Promise<UpdateAtlasConfigResult> {
  const r = await efInvoke<AtlasConfigResponse>(
    "admin-web-update-atlas-config",
    patch,
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

// ─── Atlas vocabulary (categories, tags, limits) ───────────────────────────

export type AtlasCategory = {
  slug: string;
  label: string;
  section: string;
  sort_order: number;
};

export type AtlasTag = {
  slug: string;
  label_es: string;
  label_en: string;
  facet: string;
  section: string;
  sort_order: number;
};

export type AtlasTagFacet = {
  slug: string;
  emoji: string;
  label_es: string;
  label_en: string;
};

export type AtlasFieldLimit = {
  max: number;
  note: string;
};

export type AtlasFieldsPayload = {
  categories: AtlasCategory[];
  tags: AtlasTag[];
  facets: AtlasTagFacet[];
  fieldLimits: Record<string, AtlasFieldLimit>;
  counts: { categories: number; tags: number; facets: number };
};

export async function getAtlasFields(): Promise<
  { ok: true; data: AtlasFieldsPayload } | { ok: false; error: string }
> {
  const r = await efInvoke<AtlasFieldsPayload>("admin-web-get-atlas-fields", {});
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}
