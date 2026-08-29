import { assertEquals } from "jsr:@std/assert@1";
import {
  DEFAULT_ENRICHMENT_CONFIG,
  normalizeEnrichmentConfig,
} from "./enrichment-config.ts";

Deno.test("normalizeEnrichmentConfig: null/garbage falls back to the old scalar-column defaults", () => {
  assertEquals(normalizeEnrichmentConfig(null), DEFAULT_ENRICHMENT_CONFIG);
  assertEquals(normalizeEnrichmentConfig(undefined), DEFAULT_ENRICHMENT_CONFIG);
  assertEquals(normalizeEnrichmentConfig({}), DEFAULT_ENRICHMENT_CONFIG);
  assertEquals(normalizeEnrichmentConfig("nope"), DEFAULT_ENRICHMENT_CONFIG);
  assertEquals(normalizeEnrichmentConfig(42), DEFAULT_ENRICHMENT_CONFIG);
});

Deno.test("normalizeEnrichmentConfig: live-shaped blob round-trips", () => {
  const live = {
    atlasGatherGoogleImages: 10,
    atlasGatherInstagramDepth: 30,
    atlasGatherInstagramPosts: 30,
    atlasGatherReviews: 100,
    atlasImageVisionEnabled: true,
    atlasAnalyzeGoogleImages: 10,
    atlasAnalyzeInstagramImages: 10,
    atlasSaveTotalImages: 10,
    atlasSaveImagesToStorage: true,
    atlasImageAnalysisPrompt: "Describe this.",
    atlasImageSortingPrompt: "Rank these.",
    atlasSynthesisQuality: "economy",
    atlasVisionQuality: "economy",
    atlasPerplexityPreset: "pro-search",
    atlasPerRunCostCapUsd: 1,
    atlasDiscoverWebsiteN: 5,
    atlasDiscoverInstagramN: 7,
    atlasDiscoverFacebookN: 3,
    atlasDiscoverOpentableN: 3,
    atlasDiscoverUbereatsN: 3,
    atlasRequestThreshold: 5,
  };
  assertEquals(normalizeEnrichmentConfig(live), live);
});

Deno.test("normalizeEnrichmentConfig: out-of-range ints clamp to the old CHECKs", () => {
  const out = normalizeEnrichmentConfig({
    atlasGatherGoogleImages: 99,
    atlasGatherInstagramDepth: 0,
    atlasGatherInstagramPosts: -1,
    atlasGatherReviews: 101,
    atlasAnalyzeGoogleImages: 11,
    atlasAnalyzeInstagramImages: 31,
    atlasSaveTotalImages: 20,
    atlasDiscoverWebsiteN: 11,
    atlasPerRunCostCapUsd: -3.333,
    atlasRequestThreshold: 0,
  });
  assertEquals(out.atlasGatherGoogleImages, 10);
  assertEquals(out.atlasGatherInstagramDepth, 1);
  assertEquals(out.atlasGatherInstagramPosts, 0);
  assertEquals(out.atlasGatherReviews, 100);
  assertEquals(out.atlasAnalyzeGoogleImages, 10);
  assertEquals(out.atlasAnalyzeInstagramImages, 30);
  assertEquals(out.atlasSaveTotalImages, 10);
  assertEquals(out.atlasDiscoverWebsiteN, 10);
  assertEquals(out.atlasPerRunCostCapUsd, 0);
  assertEquals(out.atlasRequestThreshold, 1);
  assertEquals(normalizeEnrichmentConfig({ atlasRequestThreshold: 999 }).atlasRequestThreshold, 100);
});

Deno.test("normalizeEnrichmentConfig: quality/preset enums reject unknown strings", () => {
  const out = normalizeEnrichmentConfig({
    atlasSynthesisQuality: "ultra",
    atlasVisionQuality: "low",
    atlasPerplexityPreset: "sonar",
  });
  assertEquals(out.atlasSynthesisQuality, "economy");
  assertEquals(out.atlasVisionQuality, "economy");
  assertEquals(out.atlasPerplexityPreset, "pro-search");
});

Deno.test("normalizeEnrichmentConfig: extra keys are dropped", () => {
  const out = normalizeEnrichmentConfig({
    atlasGatherGoogleImages: 4,
    leftoverScalar: 1,
  });
  assertEquals(out.atlasGatherGoogleImages, 4);
  assertEquals("leftoverScalar" in out, false);
  assertEquals(Object.keys(out).sort(), Object.keys(DEFAULT_ENRICHMENT_CONFIG).sort());
});
