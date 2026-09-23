"use server";

import type { ActionResult } from "@/lib/action-result";
import { efInvoke } from "@/lib/supabase-ef";

// ─── Settings read ─────────────────────────────────────────────────────────

export type SynthesisQuality = "economy" | "standard" | "high";

// Perplexity Agent preset — the "search model" for the Enricher's function 3
// (the Scout, the SERP Summary) + function 4 (the Resolver, channel link discovery,
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
     * Which of the TEN enrich functions this purchase unit buys — a pointer into
     * Docs › Crenup §A's numbering, never a numbering of its own. It held
     * stage S-numbers until MESITA-1243, which read as a rival ladder.
     */
    functions: string;
    cost: TriggerCostTier;
    blurb: string;
  }[];
  locks: Record<string, Record<string, { value: boolean; reason: string }>>;
};

// ─── Crenup prompts (read-only) ────────────────────────────────────────────
// Same contract as the trigger matrix above: the prompt TEXT is CODE-DEFINED in
// supabase `_shared/crenup-prompts.ts`, which imports the very constants the
// pipeline sends, and arrives as `crenupPromptsMeta`. The console keeps no copy
// — a second copy drifts the first time someone edits the real prompt.
//
// Read-only on purpose: these are not `app_config` knobs. Editing one live
// needs validation, versioning and an empty-prompt guard.

export type CrenupPrompt = {
  key: string;
  /** Which Crenup function owns this prompt; null when it runs inside another. */
  fn: string | null;
  /** "Scout" | "Resolver" — null when the step has no named agent. */
  agent: string | null;
  label: string;
  vendor: string;
  vendorNote: string;
  writes: string;
  instructions: string;
  input: string;
};

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
  atlasRequestThreshold: number;
  enrichmentTriggers: EnrichmentTriggersConfig;
  enrichmentTriggersMeta: EnrichmentTriggersMeta;
  crenupPromptsMeta: CrenupPrompt[];
  updatedAt: string | null;
};

type GetSettingsResult = ActionResult<{ data: SettingsResponse }>;

export async function getAtlasSettings(): Promise<GetSettingsResult> {
  const r = await efInvoke<SettingsResponse>("admin-web-get-config", {});
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

// ─── Enricher pipeline config ──────────────────────────────────────────────

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
  atlasRequestThreshold: number;
  updatedAt: string | null;
};

type UpdateAtlasConfigResult = ActionResult<{ data: AtlasConfigResponse }>;

// Partial update — pass only the fields you want to change. The `enricher`
// section takes its knobs FLAT on the body, not under `config`, which is why
// the patch is spread rather than nested.
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
  requestThreshold?: number;
}): Promise<UpdateAtlasConfigResult> {
  const r = await efInvoke<AtlasConfigResponse>(
    "admin-web-update-config",
    { section: "enricher", ...patch },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}
