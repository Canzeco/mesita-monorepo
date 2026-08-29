import { describe, expect, it } from "vitest";

import {
  computeCreateCost,
  computeEnrichTickCost,
  computeEnrichmentCost,
} from "./cost-model";
import type { IntakeSettings } from "./intake-guards";

const base = {
  quality: "economy" as const,
  imageModel: "economy" as const,
  gCollect: 5,
  igCollect: 10,
  gAnalyze: 5,
  igAnalyze: 10,
  links: {
    website: 5,
    instagram: 5,
    facebook: 3,
    opentable: 3,
    ubereats: 0,
  },
  places: 1,
};

describe("computeEnrichmentCost", () => {
  it("standard synthesis costs more than economy and stays finite", () => {
    const economy = computeEnrichmentCost(base);
    const standard = computeEnrichmentCost({ ...base, quality: "standard" });
    expect(standard.perPlace).toBeGreaterThan(economy.perPlace);
    for (const n of [
      economy.perPlace,
      economy.total,
      economy.perPlaceSecs,
      standard.perPlace,
      standard.total,
    ]) {
      expect(Number.isFinite(n)).toBe(true);
    }
  });

  it("link N=0 drops the Firecrawl discovery lines", () => {
    const none = computeEnrichmentCost({
      ...base,
      links: {
        website: 0,
        instagram: 0,
        facebook: 0,
        opentable: 0,
        ubereats: 0,
      },
    });
    const firecrawl = none.lines.find((l) => l.label === "Link discovery");
    expect(firecrawl?.active).toBe(false);
    expect(firecrawl?.cost).toBe(0);
    expect(none.active.some((l) => l.label === "Link discovery")).toBe(false);
  });

  it("zero analyze counts drop vision spend", () => {
    const off = computeEnrichmentCost({
      ...base,
      gAnalyze: 0,
      igAnalyze: 0,
    });
    expect(off.lines.find((l) => l.label === "Image descriptions")?.active).toBe(
      false,
    );
    const on = computeEnrichmentCost(base);
    expect(on.perPlace).toBeGreaterThan(off.perPlace);
  });

  it("reviews = 0 drops the Apify Google Maps line", () => {
    const off = computeEnrichmentCost({ ...base, reviews: 0 });
    expect(off.lines.find((l) => l.label === "Google reviews + images")?.active).toBe(false);
    expect(computeEnrichmentCost(base).perPlace).toBeGreaterThan(off.perPlace);
  });
});

const settings: IntakeSettings = {
  gatherGoogleImages: 10,
  gatherInstagramDepth: 30,
  gatherReviews: 100,
  imageVisionEnabled: true,
  saveImagesToStorage: true,
  saveTotalImages: 10,
  analyzeGoogleImages: 10,
  analyzeInstagramImages: 20,
  imageAnalysisPrompt: "",
  imageSortingPrompt: "",
  synthesisQuality: "economy",
  visionQuality: "economy",
  perplexityPreset: "pro-search",
  discoverWebsiteN: 5,
  discoverInstagramN: 5,
  discoverFacebookN: 3,
  discoverOpentableN: 3,
  discoverUbereatsN: 0,
  requestThreshold: 5,
};

describe("instance estimates", () => {
  it("Create bills Pulse+Details plus the door Description, one place", () => {
    // §8.4 v3: the door Description (one batched prompt) runs at create when
    // no full Enrich is queued, so the estimate bills its synthesis too.
    const c = computeCreateCost(settings);
    expect(c.places).toBe(1);
    expect(c.active.map((l) => l.label)).toEqual([
      "Google profile",
      "Google photos",
      "Timezone",
      "Presentation synthesis — economy",
      "Category → tags",
      "Persist data + images",
    ]);
  });

  it("Enrich is live knobs for one place", () => {
    const e = computeEnrichTickCost(settings);
    expect(e.places).toBe(1);
    expect(e.total).toBeCloseTo(e.perPlace);
    expect(e.perPlace).toBeGreaterThan(computeCreateCost(settings).perPlace);
  });

  it("vision off and reviews 0 drop those Enrich lines", () => {
    const e = computeEnrichTickCost({
      ...settings,
      imageVisionEnabled: false,
      gatherReviews: 0,
    });
    expect(e.active.some((l) => l.label === "Image descriptions")).toBe(false);
    expect(e.active.some((l) => l.label === "Google reviews + images")).toBe(
      false,
    );
  });
});
