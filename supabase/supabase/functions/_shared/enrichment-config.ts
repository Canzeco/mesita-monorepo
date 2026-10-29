// DEFAULT_IMAGE_*_PROMPT: twin of render/src/images.ts, pinned by render-twins.test.ts.
// Crenup (enricher) knobs: app_config.enrichment_config (MESITA-1248).
//
// Folds the 20 leftover atlas_* scalar columns into one jsonb, matching the
// whole-blob-per-domain pattern (discovery_config, reservations_config, …).
// Wire camelCase is unchanged — admin-web-get-config and the `enricher`
// section of admin-web-update-config still speak enrichGatherGoogleImages etc.
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

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { ENRICH_FIELD_LIMITS } from "./enrich-field-limits.ts";
import { asRecord } from "./config-coerce.ts";

export const DEFAULT_IMAGE_ANALYSIS_PROMPT =
  "Describe this place photo: subject (ambience / interior / exterior / food / people / detail), visual quality, lighting, and whether it is representative and appealing. Be concise and factual.";
export const DEFAULT_IMAGE_SORTING_PROMPT =
  "Rank these place photos best to worst for a should-we-go-tonight decision. We sell EXPERIENCES: weight beautiful place / ambience / vibe shots EQUALLY with food. Favor visual quality, representativeness, and a balanced mix. Drop duplicates, blurry, dark, or text-heavy images. As a minor tie-breaker only (never a primary or secondary criterion), prefer a hero whose shape is close to square over a strongly horizontal or vertical one, because the app shows it in a square tile.";

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
  enrichGatherGoogleImages: number;
  enrichGatherInstagramDepth: number;
  enrichGatherInstagramPosts: number;
  enrichGatherReviews: number;
  enrichImageVisionEnabled: boolean;
  enrichAnalyzeGoogleImages: number;
  enrichAnalyzeInstagramImages: number;
  enrichSaveTotalImages: number;
  enrichSaveImagesToStorage: boolean;
  enrichImageAnalysisPrompt: string;
  enrichImageSortingPrompt: string;
  enrichSynthesisQuality: string;
  enrichVisionQuality: string;
  enrichPerplexityPreset: string;
  enrichDiscoverWebsiteN: number;
  enrichDiscoverInstagramN: number;
  enrichDiscoverFacebookN: number;
  enrichDiscoverOpentableN: number;
  enrichDiscoverUbereatsN: number;
  /** Consumer Requests: auto-enrich when request_count reaches this. */
  enrichRequestThreshold: number;
  /**
   * CREATE ON OPEN (MESITA-2298): opening a Google-only result's full
   * profile is the one thing that mints a Mesita Place — one switch per app.
   * Off, the consumer app's open answers 403 `create_on_open_off` and the
   * admin app's Find row keeps its Google Maps link; an explicit admin
   * Create is never gated.
   */
  enrichCreateOnOpenConsumer: boolean;
  enrichCreateOnOpenAdmin: boolean;
  /**
   * Places one guest may create per rolling 24 h (MESITA-2376; was a
   * hardcoded 20 in create-quota.ts). 1000 while in test mode — lower it
   * before launch.
   */
  enrichConsumerCreatesPerDay: number;
};

export const CONSUMER_CREATES_PER_DAY_MAX = 10000;

export const DEFAULT_ENRICHMENT_CONFIG: EnrichmentConfig = {
  enrichGatherGoogleImages: 10,
  enrichGatherInstagramDepth: 10,
  enrichGatherInstagramPosts: 10,
  enrichGatherReviews: ENRICH_FIELD_LIMITS.googleReviews.max,
  enrichImageVisionEnabled: true,
  enrichAnalyzeGoogleImages: 10,
  enrichAnalyzeInstagramImages: 10,
  enrichSaveTotalImages: ENRICH_FIELD_LIMITS.photos.max,
  enrichSaveImagesToStorage: true,
  enrichImageAnalysisPrompt: DEFAULT_IMAGE_ANALYSIS_PROMPT,
  enrichImageSortingPrompt: DEFAULT_IMAGE_SORTING_PROMPT,
  enrichSynthesisQuality: "economy",
  enrichVisionQuality: "economy",
  enrichPerplexityPreset: "pro-search",
  enrichDiscoverWebsiteN: 5,
  enrichDiscoverInstagramN: 5,
  enrichDiscoverFacebookN: 5,
  enrichDiscoverOpentableN: 3,
  enrichDiscoverUbereatsN: 2,
  enrichRequestThreshold: 10, // MESITA-2653: Pato, "set it to 10"
  enrichCreateOnOpenConsumer: true,
  enrichCreateOnOpenAdmin: true,
  enrichConsumerCreatesPerDay: 1000,
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
    enrichGatherGoogleImages: intIn(r.enrichGatherGoogleImages, 0, 10, d.enrichGatherGoogleImages),
    enrichGatherInstagramDepth: intIn(r.enrichGatherInstagramDepth, 1, 30, d.enrichGatherInstagramDepth),
    enrichGatherInstagramPosts: intIn(r.enrichGatherInstagramPosts, 0, 30, d.enrichGatherInstagramPosts),
    enrichGatherReviews: intIn(r.enrichGatherReviews, 0, 100, d.enrichGatherReviews),
    enrichImageVisionEnabled: r.enrichImageVisionEnabled !== false,
    enrichAnalyzeGoogleImages: intIn(r.enrichAnalyzeGoogleImages, 0, 10, d.enrichAnalyzeGoogleImages),
    enrichAnalyzeInstagramImages: intIn(
      r.enrichAnalyzeInstagramImages,
      0,
      30,
      d.enrichAnalyzeInstagramImages,
    ),
    enrichSaveTotalImages: intIn(r.enrichSaveTotalImages, 0, 10, d.enrichSaveTotalImages),
    enrichSaveImagesToStorage: r.enrichSaveImagesToStorage !== false,
    enrichImageAnalysisPrompt: prompt(r.enrichImageAnalysisPrompt, d.enrichImageAnalysisPrompt),
    enrichImageSortingPrompt: prompt(r.enrichImageSortingPrompt, d.enrichImageSortingPrompt),
    enrichSynthesisQuality: quality(r.enrichSynthesisQuality, d.enrichSynthesisQuality),
    enrichVisionQuality: quality(r.enrichVisionQuality, d.enrichVisionQuality),
    enrichPerplexityPreset: preset(r.enrichPerplexityPreset, d.enrichPerplexityPreset),
    enrichDiscoverWebsiteN: intIn(r.enrichDiscoverWebsiteN, 0, 10, d.enrichDiscoverWebsiteN),
    enrichDiscoverInstagramN: intIn(r.enrichDiscoverInstagramN, 0, 10, d.enrichDiscoverInstagramN),
    enrichDiscoverFacebookN: intIn(r.enrichDiscoverFacebookN, 0, 10, d.enrichDiscoverFacebookN),
    enrichDiscoverOpentableN: intIn(r.enrichDiscoverOpentableN, 0, 10, d.enrichDiscoverOpentableN),
    enrichDiscoverUbereatsN: intIn(r.enrichDiscoverUbereatsN, 0, 10, d.enrichDiscoverUbereatsN),
    enrichRequestThreshold: intIn(r.enrichRequestThreshold, 1, 100, d.enrichRequestThreshold),
    enrichCreateOnOpenConsumer: r.enrichCreateOnOpenConsumer !== false,
    enrichCreateOnOpenAdmin: r.enrichCreateOnOpenAdmin !== false,
    enrichConsumerCreatesPerDay: intIn(
      r.enrichConsumerCreatesPerDay,
      1,
      CONSUMER_CREATES_PER_DAY_MAX,
      d.enrichConsumerCreatesPerDay,
    ),
  };
}

// Read + normalize app_config.enrichment_config (row id=1). A read error or a
// missing row yields the defaults. The select is a single string LITERAL on
// purpose: supabase-js infers the row type only from a literal argument.
export async function loadEnrichmentConfig(
  admin: SupabaseClient,
): Promise<EnrichmentConfig> {
  const { data } = await admin
    .from("app_config")
    .select("enrichment_config")
    .eq("id", 1)
    .maybeSingle();
  return normalizeEnrichmentConfig(
    (data as { enrichment_config?: unknown } | null)?.enrichment_config,
  );
}
