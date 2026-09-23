import { describe, expect, it } from "vitest";
import { coerceModelsConfig, DEFAULT_MODELS_CONFIG } from "./types";

describe("coerceModelsConfig", () => {
  it("resolves a null blob to the defaults", () => {
    expect(coerceModelsConfig(null)).toEqual(DEFAULT_MODELS_CONFIG);
  });

  it("reads the legacy `lineup` key as the embeddings model", () => {
    expect(coerceModelsConfig({ lineup: { model: "x" } }).embeddings.model).toBe("x");
  });

  it("prefers `embeddings` over the legacy `lineup` when both are present", () => {
    const cfg = coerceModelsConfig({
      embeddings: { model: "new" },
      lineup: { model: "old" },
    });
    expect(cfg.embeddings.model).toBe("new");
  });

  it("falls back to the default for an unknown enricher.perplexity", () => {
    const cfg = coerceModelsConfig({ enricher: { perplexity: "not-a-model" } });
    expect(cfg.enricher.perplexity).toBe(DEFAULT_MODELS_CONFIG.enricher.perplexity);
  });
});
