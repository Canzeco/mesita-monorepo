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
    enrichGatherGoogleImages: 10,
    enrichGatherInstagramDepth: 10,
    enrichGatherInstagramPosts: 10,
    enrichGatherReviews: 100,
    enrichImageVisionEnabled: true,
    enrichAnalyzeGoogleImages: 10,
    enrichAnalyzeInstagramImages: 10,
    enrichSaveTotalImages: 10,
    enrichSaveImagesToStorage: true,
    enrichImageAnalysisPrompt: "Describe this.",
    enrichImageSortingPrompt: "Rank these.",
    enrichSynthesisQuality: "economy",
    enrichVisionQuality: "economy",
    enrichPerplexityPreset: "pro-search",
    enrichDiscoverWebsiteN: 5,
    enrichDiscoverInstagramN: 7,
    enrichDiscoverFacebookN: 3,
    enrichDiscoverOpentableN: 3,
    enrichDiscoverUbereatsN: 3,
    enrichRequestThreshold: 5,
    updateEveryViews: 20,
    enrichCreateOnOpenConsumer: true,
    enrichCreateOnOpenAdmin: false,
    enrichConsumerCreatesPerDay: 250,
  };
  assertEquals(normalizeEnrichmentConfig(live), live);
});

Deno.test("normalizeEnrichmentConfig: guest creates per day is 1000 unless stored, clamped 1–10000 (MESITA-2376)", () => {
  assertEquals(DEFAULT_ENRICHMENT_CONFIG.enrichConsumerCreatesPerDay, 1000);
  assertEquals(normalizeEnrichmentConfig({}).enrichConsumerCreatesPerDay, 1000);
  assertEquals(normalizeEnrichmentConfig({ enrichConsumerCreatesPerDay: 0 }).enrichConsumerCreatesPerDay, 1);
  assertEquals(normalizeEnrichmentConfig({ enrichConsumerCreatesPerDay: 99999 }).enrichConsumerCreatesPerDay, 10000);
  assertEquals(normalizeEnrichmentConfig({ enrichConsumerCreatesPerDay: "x" }).enrichConsumerCreatesPerDay, 1000);
});

Deno.test("normalizeEnrichmentConfig: Create-on-open is one switch per app, on unless stored false (MESITA-2298)", () => {
  assertEquals(DEFAULT_ENRICHMENT_CONFIG.enrichCreateOnOpenConsumer, true);
  assertEquals(DEFAULT_ENRICHMENT_CONFIG.enrichCreateOnOpenAdmin, true);
  // An old blob without the keys keeps today's behavior: opens create.
  const old = normalizeEnrichmentConfig({ enrichRequestThreshold: 5 });
  assertEquals(old.enrichCreateOnOpenConsumer, true);
  assertEquals(old.enrichCreateOnOpenAdmin, true);
  // Only a stored `false` turns one off; garbage is not "off".
  const off = normalizeEnrichmentConfig({
    enrichCreateOnOpenConsumer: false,
    enrichCreateOnOpenAdmin: "no",
  });
  assertEquals(off.enrichCreateOnOpenConsumer, false);
  assertEquals(off.enrichCreateOnOpenAdmin, true);
});

Deno.test("normalizeEnrichmentConfig: out-of-range ints clamp to the old CHECKs", () => {
  const out = normalizeEnrichmentConfig({
    enrichGatherGoogleImages: 99,
    enrichGatherInstagramDepth: 0,
    enrichGatherInstagramPosts: -1,
    enrichGatherReviews: 101,
    enrichAnalyzeGoogleImages: 11,
    enrichAnalyzeInstagramImages: 31,
    enrichSaveTotalImages: 20,
    enrichDiscoverWebsiteN: 11,
    enrichRequestThreshold: 0,
  });
  assertEquals(out.enrichGatherGoogleImages, 10);
  assertEquals(out.enrichGatherInstagramDepth, 1);
  assertEquals(out.enrichGatherInstagramPosts, 0);
  assertEquals(out.enrichGatherReviews, 100);
  assertEquals(out.enrichAnalyzeGoogleImages, 10);
  assertEquals(out.enrichAnalyzeInstagramImages, 30);
  assertEquals(out.enrichSaveTotalImages, 10);
  assertEquals(out.enrichDiscoverWebsiteN, 10);
  assertEquals(out.enrichRequestThreshold, 1);
  assertEquals(normalizeEnrichmentConfig({ enrichRequestThreshold: 999 }).enrichRequestThreshold, 100);
});

Deno.test("normalizeEnrichmentConfig: quality/preset enums reject unknown strings", () => {
  const out = normalizeEnrichmentConfig({
    enrichSynthesisQuality: "ultra",
    enrichVisionQuality: "low",
    enrichPerplexityPreset: "sonar",
  });
  assertEquals(out.enrichSynthesisQuality, "economy");
  assertEquals(out.enrichVisionQuality, "economy");
  assertEquals(out.enrichPerplexityPreset, "pro-search");
});

Deno.test("normalizeEnrichmentConfig: extra keys are dropped", () => {
  const out = normalizeEnrichmentConfig({
    enrichGatherGoogleImages: 4,
    leftoverScalar: 1,
    // Retired by MESITA-2144; the live row still carries it until step 2.
    atlasPerRunCostCapUsd: 1,
  });
  assertEquals(out.enrichGatherGoogleImages, 4);
  assertEquals("leftoverScalar" in out, false);
  assertEquals("atlasPerRunCostCapUsd" in out, false);
  assertEquals(Object.keys(out).sort(), Object.keys(DEFAULT_ENRICHMENT_CONFIG).sort());
});
