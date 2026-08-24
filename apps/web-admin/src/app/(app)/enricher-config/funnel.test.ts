import { describe, expect, it } from "vitest";

import { clampFunnel, type IntakeSettings } from "./funnel";

const base = (): IntakeSettings => ({
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
  perRunCostCapUsd: 1,
  discoverWebsiteN: 5,
  discoverInstagramN: 5,
  discoverFacebookN: 3,
  discoverOpentableN: 3,
  discoverUbereatsN: 0,
});

describe("clampFunnel", () => {
  it("leaves a legal chain alone", () => {
    const s = base();
    expect(clampFunnel(s)).toEqual(s);
  });

  it("pulls analyze and gallery down when collect shrinks", () => {
    const next = clampFunnel({
      ...base(),
      gatherGoogleImages: 3,
      analyzeGoogleImages: 10,
      analyzeInstagramImages: 20,
      saveTotalImages: 10,
    });
    expect(next.gatherGoogleImages).toBe(3);
    expect(next.analyzeGoogleImages).toBe(3);
    expect(next.saveTotalImages).toBe(Math.min(10, 3 + 20));
  });

  it("caps gallery at the DB max even when analyze is larger", () => {
    const next = clampFunnel({
      ...base(),
      analyzeGoogleImages: 10,
      analyzeInstagramImages: 10,
      saveTotalImages: 99,
    });
    expect(next.saveTotalImages).toBe(10);
  });
});
