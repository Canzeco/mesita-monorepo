"use server";

import { efInvoke } from "@/lib/supabase-ef";

// ─── Settings read ─────────────────────────────────────────────────────────

export type SynthesisQuality = "economy" | "standard" | "high";

// Perplexity Agent preset — the "search model" for the Intaker's function 3
// (Agent X, the SERP Summary) + function 4 (Agent Y, channel link discovery,
// which grounds on function 3's text). Mirrors the Perplexity Agent API
// preset names (docs.perplexity.ai/docs/agent-api/presets).
export type PerplexityPreset =
  | "fast-search"
  | "pro-search"
  | "deep-research"
  | "advanced-deep-research";


// ─── Enrichment trigger matrix ─────────────────────────────────────────────
// The vocabulary (which triggers and subprocesses exist, which cells are
// locked) is CODE-DEFINED in supabase `_shared/enrich-triggers.ts` and arrives
// as `enrichmentTriggersMeta`. The console renders whatever the backend
// declares — it deliberately keeps no copy of the list, because a second copy
// drifts the first time a subprocess is added.

export type TriggerCostTier = "free" | "low" | "high";

export type EnrichmentTriggerRow = {
  enabled: boolean;
  cooldownHours: number;
  subprocesses: Record<string, boolean>;
};

export type EnrichmentTriggersConfig = Record<string, EnrichmentTriggerRow>;

export type EnrichmentTriggersMeta = {
  triggers: { key: string; label: string; blurb: string; staged: boolean }[];
  subprocesses: {
    key: string;
    label: string;
    /**
     * Which of the NINE enrich functions this purchase unit buys — a pointer into
     * Docs › Intake §A's numbering, never a numbering of its own. It held
     * stage S-numbers until MESITA-1243, which read as a rival ladder.
     */
    functions: string;
    cost: TriggerCostTier;
    blurb: string;
  }[];
  locks: Record<string, Record<string, { value: boolean; reason: string }>>;
};

type UpdateTriggersResult =
  | { ok: true; data: EnrichmentTriggersConfig }
  | { ok: false; error: string };

/** WHOLE-blob save: the page always sends the full grid, never a patch. */
export async function updateEnrichmentTriggers(
  enrichmentTriggers: EnrichmentTriggersConfig,
): Promise<UpdateTriggersResult> {
  const r = await efInvoke<{ enrichmentTriggers: EnrichmentTriggersConfig }>(
    "admin-web-update-enricher-config",
    { enrichmentTriggers },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data.enrichmentTriggers };
}

type SettingsResponse = {
  autoVerifyAiCall: boolean;
  autoVerifyAiEmail: boolean;
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
  enrichmentTriggers: EnrichmentTriggersConfig;
  enrichmentTriggersMeta: EnrichmentTriggersMeta;
  updatedAt: string | null;
};

type GetSettingsResult =
  | { ok: true; data: SettingsResponse }
  | { ok: false; error: string };

export async function getAtlasSettings(): Promise<GetSettingsResult> {
  const r = await efInvoke<SettingsResponse>("admin-web-get-config", {});
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

// ─── Intaker pipeline config ──────────────────────────────────────────────

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
  discoverWebsiteN?: number;
  discoverInstagramN?: number;
  discoverFacebookN?: number;
  discoverOpentableN?: number;
  discoverUbereatsN?: number;
}): Promise<UpdateAtlasConfigResult> {
  const r = await efInvoke<AtlasConfigResponse>(
    "admin-web-update-enricher-config",
    patch,
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}
