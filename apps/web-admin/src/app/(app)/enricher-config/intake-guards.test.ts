import { describe, expect, it } from "vitest";

import {
  clampFunnel,
  intakeSaveBlocked,
  type IntakeSettings,
} from "./intake-guards";

const seed: IntakeSettings = {
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

describe("intakeSaveBlocked", () => {
  it("lets Save through when the GET succeeded", () => {
    expect(intakeSaveBlocked(null)).toBeNull();
  });

  it("blocks Save when the Intaker GET fails — client defaults must not POST", () => {
    expect(intakeSaveBlocked("timeout")).toBe("timeout");
  });
});

describe("clampFunnel", () => {
  it("leaves a legal chain alone", () => {
    expect(clampFunnel(seed)).toEqual(seed);
  });

  it("never lets analyze exceed collect, or gallery exceed analyzed", () => {
    const out = clampFunnel({
      ...seed,
      gatherGoogleImages: 3,
      gatherInstagramDepth: 4,
      analyzeGoogleImages: 9,
      analyzeInstagramImages: 20,
      saveTotalImages: 40,
    });
    expect(out.analyzeGoogleImages).toBe(3);
    expect(out.analyzeInstagramImages).toBe(4);
    expect(out.saveTotalImages).toBe(7);
  });

  it("caps gallery at the DB max even when analyze is larger", () => {
    const next = clampFunnel({
      ...seed,
      analyzeGoogleImages: 10,
      analyzeInstagramImages: 10,
      saveTotalImages: 99,
    });
    expect(next.saveTotalImages).toBe(10);
  });

  it("clamps request threshold to 1–100", () => {
    expect(clampFunnel({ ...seed, requestThreshold: 0 }).requestThreshold).toBe(1);
    expect(clampFunnel({ ...seed, requestThreshold: 999 }).requestThreshold)
      .toBe(100);
  });

  it("Instagram vision Y cannot exceed last-X newest", () => {
    const out = clampFunnel({
      ...seed,
      gatherInstagramDepth: 8,
      analyzeInstagramImages: 30,
    });
    expect(out.analyzeInstagramImages).toBe(8);
  });
});
