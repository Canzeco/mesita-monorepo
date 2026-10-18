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
    atlasGatherInstagramDepth: 10,
    atlasGatherInstagramPosts: 10,
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
    atlasDiscoverWebsiteN: 5,
    atlasDiscoverInstagramN: 7,
    atlasDiscoverFacebookN: 3,
    atlasDiscoverOpentableN: 3,
    atlasDiscoverUbereatsN: 3,
    atlasRequestThreshold: 5,
    atlasCreateOnOpenConsumer: true,
    atlasCreateOnOpenAdmin: false,
    atlasConsumerCreatesPerDay: 250,
  };
  assertEquals(normalizeEnrichmentConfig(live), live);
});

Deno.test("normalizeEnrichmentConfig: guest creates per day is 1000 unless stored, clamped 1–10000 (MESITA-2376)", () => {
  assertEquals(DEFAULT_ENRICHMENT_CONFIG.atlasConsumerCreatesPerDay, 1000);
  assertEquals(normalizeEnrichmentConfig({}).atlasConsumerCreatesPerDay, 1000);
  assertEquals(normalizeEnrichmentConfig({ atlasConsumerCreatesPerDay: 0 }).atlasConsumerCreatesPerDay, 1);
  assertEquals(normalizeEnrichmentConfig({ atlasConsumerCreatesPerDay: 99999 }).atlasConsumerCreatesPerDay, 10000);
  assertEquals(normalizeEnrichmentConfig({ atlasConsumerCreatesPerDay: "x" }).atlasConsumerCreatesPerDay, 1000);
});

Deno.test("normalizeEnrichmentConfig: Create-on-open is one switch per app, on unless stored false (MESITA-2298)", () => {
  assertEquals(DEFAULT_ENRICHMENT_CONFIG.atlasCreateOnOpenConsumer, true);
  assertEquals(DEFAULT_ENRICHMENT_CONFIG.atlasCreateOnOpenAdmin, true);
  // An old blob without the keys keeps today's behavior: opens create.
  const old = normalizeEnrichmentConfig({ atlasRequestThreshold: 5 });
  assertEquals(old.atlasCreateOnOpenConsumer, true);
  assertEquals(old.atlasCreateOnOpenAdmin, true);
  // Only a stored `false` turns one off; garbage is not "off".
  const off = normalizeEnrichmentConfig({
    atlasCreateOnOpenConsumer: false,
    atlasCreateOnOpenAdmin: "no",
  });
  assertEquals(off.atlasCreateOnOpenConsumer, false);
  assertEquals(off.atlasCreateOnOpenAdmin, true);
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
    // Retired by MESITA-2144; the live row still carries it until step 2.
    atlasPerRunCostCapUsd: 1,
  });
  assertEquals(out.atlasGatherGoogleImages, 4);
  assertEquals("leftoverScalar" in out, false);
  assertEquals("atlasPerRunCostCapUsd" in out, false);
  assertEquals(Object.keys(out).sort(), Object.keys(DEFAULT_ENRICHMENT_CONFIG).sort());
});
