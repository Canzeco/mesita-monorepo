// Crenup (enricher) knobs: app_config.enrichment_config (MESITA-1248).
//
// Folds the 20 leftover atlas_* scalar columns into one jsonb, matching the
// whole-blob-per-domain pattern (discovery_config, reservations_config, …).
// Wire camelCase is unchanged — admin-web-get-config and the `enricher`
// section of admin-web-update-config still speak atlasGatherGoogleImages etc.
// enrichment_triggers stays its own jsonb; the Crenup page already saves that
// whole grid.
//
// Ranges re-encode the CHECKs that used to sit on the scalar columns. The
// image-funnel lock (analyze ≤ keep per source · save ≤ analyzed total) stays
// write-path only, same as before.
//
// atlasPerRunCostCapUsd is gone (MESITA-2144): no run ever read it once the
// dollar abort was retired. A stored copy is unknown here, so it is dropped on
// the next write, the same as any other leftover key.

import { ENRICH_FIELD_LIMITS } from "./enrich-field-limits.ts";
import { asRecord } from "./config-coerce.ts";

export const DEFAULT_IMAGE_ANALYSIS_PROMPT =
  "Describe this place photo: subject (ambience / interior / exterior / food / people / detail), visual quality, lighting, and whether it is representative and appealing. Be concise and factual.";
export const DEFAULT_IMAGE_SORTING_PROMPT =
  "Rank these place photos best to worst for a should-we-go-tonight decision. We sell EXPERIENCES: weight beautiful place / ambience / vibe shots EQUALLY with food. Favor visual quality, representativeness, and a balanced mix. Drop duplicates, blurry, dark, or text-heavy images.";

// Two tiers since MESITA-2126. A legacy "high" (same gpt-4o as "standard") is
// mapped explicitly: the generic fallback below is the cheap default, so an
// unmapped "high" would silently downgrade the place to gpt-4o-mini.
const QUALITY = new Set(["economy", "standard"]);
const PERPLEXITY = new Set([
  "fast-search",
  "pro-search",
  "deep-research",
  "advanced-deep-research",
]);

export type EnrichmentConfig = {
  atlasGatherGoogleImages: number;
  atlasGatherInstagramDepth: number;
  atlasGatherInstagramPosts: number;
  atlasGatherReviews: number;
  atlasImageVisionEnabled: boolean;
  atlasAnalyzeGoogleImages: number;
  atlasAnalyzeInstagramImages: number;
  atlasSaveTotalImages: number;
  atlasSaveImagesToStorage: boolean;
  atlasImageAnalysisPrompt: string;
  atlasImageSortingPrompt: string;
  atlasSynthesisQuality: string;
  atlasVisionQuality: string;
  atlasPerplexityPreset: string;
  atlasDiscoverWebsiteN: number;
  atlasDiscoverInstagramN: number;
  atlasDiscoverFacebookN: number;
  atlasDiscoverOpentableN: number;
  atlasDiscoverUbereatsN: number;
  /** Consumer Requests: auto-enrich when request_count reaches this. */
  atlasRequestThreshold: number;
  /**
   * CREATE ON OPEN (MESITA-2298): opening a Google-only result's full
   * profile is the one thing that mints a Mesita Place — one switch per app.
   * Off, the consumer app's open answers 403 `create_on_open_off` and the
   * admin app's Find row keeps its Google Maps link; an explicit admin
   * Create is never gated.
   */
  atlasCreateOnOpenConsumer: boolean;
  atlasCreateOnOpenAdmin: boolean;
  /**
   * Places one guest may create per rolling 24 h (MESITA-2376; was a
   * hardcoded 20 in create-quota.ts). 1000 while in test mode — lower it
   * before launch.
   */
  atlasConsumerCreatesPerDay: number;
};

export const CONSUMER_CREATES_PER_DAY_MAX = 10000;

export const DEFAULT_ENRICHMENT_CONFIG: EnrichmentConfig = {
  atlasGatherGoogleImages: 10,
  atlasGatherInstagramDepth: 10,
  atlasGatherInstagramPosts: 10,
  atlasGatherReviews: ENRICH_FIELD_LIMITS.googleReviews.max,
  atlasImageVisionEnabled: true,
  atlasAnalyzeGoogleImages: 10,
  atlasAnalyzeInstagramImages: 10,
  atlasSaveTotalImages: ENRICH_FIELD_LIMITS.photos.max,
  atlasSaveImagesToStorage: true,
  atlasImageAnalysisPrompt: DEFAULT_IMAGE_ANALYSIS_PROMPT,
  atlasImageSortingPrompt: DEFAULT_IMAGE_SORTING_PROMPT,
  atlasSynthesisQuality: "economy",
  atlasVisionQuality: "economy",
  atlasPerplexityPreset: "pro-search",
  atlasDiscoverWebsiteN: 5,
  atlasDiscoverInstagramN: 5,
  atlasDiscoverFacebookN: 5,
  atlasDiscoverOpentableN: 3,
  atlasDiscoverUbereatsN: 2,
  atlasRequestThreshold: 5,
  atlasCreateOnOpenConsumer: true,
  atlasCreateOnOpenAdmin: true,
  atlasConsumerCreatesPerDay: 1000,
};

function intIn(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function quality(v: unknown, fallback: string): string {
  if (v === "high") return "standard";
  return typeof v === "string" && QUALITY.has(v) ? v : fallback;
}

function preset(v: unknown, fallback: string): string {
  return typeof v === "string" && PERPLEXITY.has(v) ? v : fallback;
}

function prompt(v: unknown, fallback: string): string {
  if (typeof v !== "string") return fallback;
  const t = v.trim();
  if (t.length === 0) return fallback;
  return t.length > 4000 ? t.slice(0, 4000) : t;
}

export function normalizeEnrichmentConfig(raw: unknown): EnrichmentConfig {
  const r = asRecord(raw);
  const d = DEFAULT_ENRICHMENT_CONFIG;
  return {
    atlasGatherGoogleImages: intIn(r.atlasGatherGoogleImages, 0, 10, d.atlasGatherGoogleImages),
    atlasGatherInstagramDepth: intIn(r.atlasGatherInstagramDepth, 1, 30, d.atlasGatherInstagramDepth),
    atlasGatherInstagramPosts: intIn(r.atlasGatherInstagramPosts, 0, 30, d.atlasGatherInstagramPosts),
    atlasGatherReviews: intIn(r.atlasGatherReviews, 0, 100, d.atlasGatherReviews),
    atlasImageVisionEnabled: r.atlasImageVisionEnabled !== false,
    atlasAnalyzeGoogleImages: intIn(r.atlasAnalyzeGoogleImages, 0, 10, d.atlasAnalyzeGoogleImages),
    atlasAnalyzeInstagramImages: intIn(
      r.atlasAnalyzeInstagramImages,
      0,
      30,
      d.atlasAnalyzeInstagramImages,
    ),
    atlasSaveTotalImages: intIn(r.atlasSaveTotalImages, 0, 10, d.atlasSaveTotalImages),
    atlasSaveImagesToStorage: r.atlasSaveImagesToStorage !== false,
    atlasImageAnalysisPrompt: prompt(r.atlasImageAnalysisPrompt, d.atlasImageAnalysisPrompt),
    atlasImageSortingPrompt: prompt(r.atlasImageSortingPrompt, d.atlasImageSortingPrompt),
    atlasSynthesisQuality: quality(r.atlasSynthesisQuality, d.atlasSynthesisQuality),
    atlasVisionQuality: quality(r.atlasVisionQuality, d.atlasVisionQuality),
    atlasPerplexityPreset: preset(r.atlasPerplexityPreset, d.atlasPerplexityPreset),
    atlasDiscoverWebsiteN: intIn(r.atlasDiscoverWebsiteN, 0, 10, d.atlasDiscoverWebsiteN),
    atlasDiscoverInstagramN: intIn(r.atlasDiscoverInstagramN, 0, 10, d.atlasDiscoverInstagramN),
    atlasDiscoverFacebookN: intIn(r.atlasDiscoverFacebookN, 0, 10, d.atlasDiscoverFacebookN),
    atlasDiscoverOpentableN: intIn(r.atlasDiscoverOpentableN, 0, 10, d.atlasDiscoverOpentableN),
    atlasDiscoverUbereatsN: intIn(r.atlasDiscoverUbereatsN, 0, 10, d.atlasDiscoverUbereatsN),
    atlasRequestThreshold: intIn(r.atlasRequestThreshold, 1, 100, d.atlasRequestThreshold),
    atlasCreateOnOpenConsumer: r.atlasCreateOnOpenConsumer !== false,
    atlasCreateOnOpenAdmin: r.atlasCreateOnOpenAdmin !== false,
    atlasConsumerCreatesPerDay: intIn(
      r.atlasConsumerCreatesPerDay,
      1,
      CONSUMER_CREATES_PER_DAY_MAX,
      d.atlasConsumerCreatesPerDay,
    ),
  };
}
