"use server";

import { efInvoke } from "@/lib/supabase-ef";

// ─── Settings read ─────────────────────────────────────────────────────────

export type SynthesisQuality = "economy" | "standard" | "high";

type SettingsResponse = {
  autoVerifyAiCall: boolean;
  autoVerifyAiEmail: boolean;
  autoVerifyVideo: boolean;
  atlasGatherGoogleImages: number;
  atlasGatherWebsiteImages: number;
  atlasGatherInstagramPosts: number;
  atlasSourceTierCeiling: number;
  atlasSourceOverrides: Record<string, boolean>;
  atlasWebsiteCrawlMaxPages: number;
  atlasImageVisionEnabled: boolean;
  atlasAnalyzeGoogleImages: number;
  atlasAnalyzeWebsiteImages: number;
  atlasImageAnalysisPrompt: string;
  atlasImageSortingPrompt: string;
  atlasAnalyzeInstagramImages: number;
  atlasSaveTotalImages: number;
  atlasSynthesisQuality: SynthesisQuality;
  atlasVisionQuality: SynthesisQuality;
  atlasPerRunCostCapUsd: number;
  updatedAt: string | null;
};

type GetSettingsResult =
  | { ok: true; data: SettingsResponse }
  | { ok: false; error: string };

export async function getAtlasSettings(): Promise<GetSettingsResult> {
  const r = await efInvoke<SettingsResponse>("admin-get-settings", {});
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

// ─── Atlas research config ─────────────────────────────────────────────────

type AtlasConfigResponse = {
  atlasGatherGoogleImages: number;
  atlasGatherWebsiteImages: number;
  atlasGatherInstagramPosts: number;
  atlasSourceTierCeiling: number;
  atlasSourceOverrides: Record<string, boolean>;
  atlasWebsiteCrawlMaxPages: number;
  atlasImageVisionEnabled: boolean;
  atlasAnalyzeGoogleImages: number;
  atlasAnalyzeWebsiteImages: number;
  atlasImageAnalysisPrompt: string;
  atlasImageSortingPrompt: string;
  atlasAnalyzeInstagramImages: number;
  atlasSaveTotalImages: number;
  atlasSynthesisQuality: SynthesisQuality;
  atlasVisionQuality: SynthesisQuality;
  atlasPerRunCostCapUsd: number;
  updatedAt: string | null;
};

type UpdateAtlasConfigResult =
  | { ok: true; data: AtlasConfigResponse }
  | { ok: false; error: string };

// Partial update — pass only the fields you want to change.
export async function updateAtlasConfig(patch: {
  sourceTierCeiling?: number;
  sourceOverrides?: Record<string, boolean>;
  websiteCrawlMaxPages?: number;
  gatherGoogleImages?: number;
  gatherWebsiteImages?: number;
  gatherInstagramPosts?: number;
  imageVisionEnabled?: boolean;
  analyzeGoogleImages?: number;
  analyzeWebsiteImages?: number;
  analyzeInstagramImages?: number;
  saveTotalImages?: number;
  imageAnalysisPrompt?: string;
  imageSortingPrompt?: string;
  synthesisQuality?: SynthesisQuality;
  visionQuality?: SynthesisQuality;
  perRunCostCapUsd?: number;
}): Promise<UpdateAtlasConfigResult> {
  const r = await efInvoke<AtlasConfigResponse>(
    "admin-update-atlas-config",
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
  const r = await efInvoke<AtlasFieldsPayload>("admin-get-atlas-fields", {});
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}
