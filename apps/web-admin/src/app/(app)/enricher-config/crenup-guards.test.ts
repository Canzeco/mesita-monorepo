import { describe, expect, it } from "vitest";

import {
  clampFunnel,
  savePayload,
  type CrenupSettings,
} from "./crenup-guards";

const seed: CrenupSettings = {
  gatherGoogleImages: 10,
  gatherInstagramDepth: 10,
  gatherReviews: 100,
  imageVisionEnabled: true,
  saveImagesToStorage: true,
  saveTotalImages: 10,
  analyzeGoogleImages: 10,
  analyzeInstagramImages: 10,
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
  createOnOpenConsumer: true,
  createOnOpenAdmin: true,
  consumerCreatesPerDay: 1000,
  updateEveryViews: 10,
  reviewsUpdateEveryViews: 50,
  updateFirstAfterViews: 10,
  reviewsUpdateFirstAfterViews: 50,
  enrichEveryViews: 300,
};

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

// A live enrichment_config write (MESITA-3939): the exact keys and values one
// Save sends, written out by hand. Every value is distinct, so a swapped
// mapping fails; the key list is exact, so a model tier can never leak in.
describe("savePayload", () => {
  const s: CrenupSettings = {
    gatherGoogleImages: 7,
    gatherInstagramDepth: 21,
    gatherReviews: 99,
    imageVisionEnabled: false,
    saveImagesToStorage: false,
    saveTotalImages: 6,
    analyzeGoogleImages: 5,
    analyzeInstagramImages: 4,
    imageAnalysisPrompt: "analyse",
    imageSortingPrompt: "sort",
    synthesisQuality: "standard",
    visionQuality: "standard",
    perplexityPreset: "deep-research",
    discoverWebsiteN: 1,
    discoverInstagramN: 2,
    discoverFacebookN: 3,
    discoverOpentableN: 8,
    discoverUbereatsN: 9,
    requestThreshold: 11,
    createOnOpenConsumer: false,
    createOnOpenAdmin: true,
    consumerCreatesPerDay: 123,
    updateEveryViews: 12,
    reviewsUpdateEveryViews: 13,
    updateFirstAfterViews: 14,
    reviewsUpdateFirstAfterViews: 15,
    enrichEveryViews: 16,
  };

  it("sends exactly these 25 keys and values", () => {
    expect(savePayload(s)).toEqual({
      gatherGoogleImages: 7,
      gatherInstagramDepth: 21,
      gatherInstagramPosts: 4,
      gatherReviews: 99,
      imageVisionEnabled: false,
      saveImagesToStorage: false,
      saveTotalImages: 6,
      analyzeGoogleImages: 5,
      analyzeInstagramImages: 4,
      imageAnalysisPrompt: "analyse",
      imageSortingPrompt: "sort",
      discoverWebsiteN: 1,
      discoverInstagramN: 2,
      discoverFacebookN: 3,
      discoverOpentableN: 8,
      discoverUbereatsN: 9,
      requestThreshold: 11,
      createOnOpenConsumer: false,
      createOnOpenAdmin: true,
      consumerCreatesPerDay: 123,
      updateEveryViews: 12,
      reviewsUpdateEveryViews: 13,
      updateFirstAfterViews: 14,
      reviewsUpdateFirstAfterViews: 15,
      enrichEveryViews: 16,
    });
    expect(Object.keys(savePayload(s)).sort()).toEqual([
      "analyzeGoogleImages", "analyzeInstagramImages", "consumerCreatesPerDay",
      "createOnOpenAdmin", "createOnOpenConsumer", "discoverFacebookN",
      "discoverInstagramN", "discoverOpentableN", "discoverUbereatsN",
      "discoverWebsiteN", "enrichEveryViews", "gatherGoogleImages",
      "gatherInstagramDepth", "gatherInstagramPosts", "gatherReviews",
      "imageAnalysisPrompt", "imageSortingPrompt", "imageVisionEnabled",
      "requestThreshold", "reviewsUpdateEveryViews", "reviewsUpdateFirstAfterViews",
      "saveImagesToStorage", "saveTotalImages", "updateEveryViews", "updateFirstAfterViews",
    ]);
  });
});
