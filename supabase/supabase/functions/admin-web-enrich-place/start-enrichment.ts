// What a direct enrich call starts. One place is enrich single place. A list
// is enrich multiple places, and Render decides how many run at once.
// The Google place id rides along so Render does not read the database.
// The Enrichment page knobs ride along too: Render has no database key.

import { RESOLVER_INSTRUCTIONS } from "../_shared/enrich-channel-discovery.ts";
import { visionModelFor, type EnrichConfig } from "../_shared/enrich-config.ts";

const WORKFLOW = "mesita-monorepo";

export type EnrichmentKnobs = {
  discoverWebsiteN: number;
  discoverInstagramN: number;
  discoverFacebookN: number;
  discoverOpentableN: number;
  discoverUbereatsN: number;
  perplexityPreset: string;
  resolverInstructions: string;
  gatherGoogleImages: number;
  gatherInstagramDepth: number;
  analyzeGoogleImages: number;
  analyzeInstagramImages: number;
  saveTotalImages: number;
  visionEnabled: boolean;
  saveImagesToStorage: boolean;
  imageAnalysisPrompt: string;
  imageSortingPrompt: string;
  visionModel: string;
  sortModel: string;
};

export type EnrichDepth = "quick" | "full";

export type EnrichJob = {
  placeId: string;
  googlePlaceId: string;
  knobs?: EnrichmentKnobs;
  /** Absent is Full. */
  depth?: EnrichDepth;
};

/** Anything other than quick is the whole enrichment. */
export function enrichDepthOf(value: unknown): EnrichDepth {
  return value === "quick" ? "quick" : "full";
}

type KnobSource = Pick<
  EnrichConfig,
  | "discoverCandidates"
  | "perplexityPreset"
  | "visionQuality"
  | "synthesisQuality"
  | "gatherGoogleImages"
  | "gatherInstagramDepth"
  | "analyzeGoogleImages"
  | "analyzeInstagramImages"
  | "saveTotalImages"
  | "visionEnabled"
  | "saveImagesToStorage"
  | "imageAnalysisPrompt"
  | "imageSortingPrompt"
>;

/** The saved Enrichment page, in the shape Render reads. The Resolver text is
 *  the same constant the console shows. */
export function enrichmentKnobs(cfg: KnobSource): EnrichmentKnobs {
  return {
    discoverWebsiteN: cfg.discoverCandidates.website_url,
    discoverInstagramN: cfg.discoverCandidates.instagram_url,
    discoverFacebookN: cfg.discoverCandidates.facebook_url,
    discoverOpentableN: cfg.discoverCandidates.opentable_url,
    discoverUbereatsN: cfg.discoverCandidates.uber_eats_url,
    perplexityPreset: cfg.perplexityPreset,
    resolverInstructions: RESOLVER_INSTRUCTIONS,
    gatherGoogleImages: cfg.gatherGoogleImages,
    gatherInstagramDepth: cfg.gatherInstagramDepth,
    analyzeGoogleImages: cfg.analyzeGoogleImages,
    analyzeInstagramImages: cfg.analyzeInstagramImages,
    saveTotalImages: cfg.saveTotalImages,
    visionEnabled: cfg.visionEnabled,
    saveImagesToStorage: cfg.saveImagesToStorage,
    imageAnalysisPrompt: cfg.imageAnalysisPrompt,
    imageSortingPrompt: cfg.imageSortingPrompt,
    visionModel: visionModelFor(cfg.visionQuality),
    sortModel: visionModelFor(cfg.synthesisQuality),
  };
}

/** The only write before the profile exists. The proxy sets it before it
 *  calls Render, and turns it off again if Render refuses the run: ready when
 *  the place was enriched before, failed when it never was. Render writes the
 *  profile once, at the end. */
export const ENRICHING_PATCH = { content_state: "generating" } as const;

/** The live secret is RENDER_KEY. RENDER_API_KEY is the older name. */
export function renderApiKey(env: { get(name: string): string | undefined }): string {
  return (env.get("RENDER_KEY") ?? env.get("RENDER_API_KEY") ?? "").trim();
}

export function enrichmentRun(jobs: readonly EnrichJob[]): { task: string; input: unknown[] } {
  if (jobs.length === 1) {
    return { task: `${WORKFLOW}/enrich-single-place`, input: [jobs[0]] };
  }
  return { task: `${WORKFLOW}/enrich-multiple-places`, input: [jobs] };
}
