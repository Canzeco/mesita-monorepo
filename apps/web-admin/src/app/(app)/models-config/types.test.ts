import { describe, expect, it, vi } from "vitest";
import {
  changedEnricherFields,
  coerceModelsConfig,
  DEFAULT_MODELS_CONFIG,
  runSave,
  withMemo,
  type EnricherModelSettings,
  type ModelsConfig,
} from "./types";

const ENRICHER: EnricherModelSettings = {
  synthesisQuality: "efficient",
  visionQuality: "efficient",
  perplexityPreset: "pro-search",
};

describe("coerceModelsConfig", () => {
  it("resolves a null blob to the defaults", () => {
    expect(coerceModelsConfig(null)).toEqual(DEFAULT_MODELS_CONFIG);
  });

  it("drops the dead keys a stored blob may still carry, so a save never sends them back", () => {
    const cfg = coerceModelsConfig({
      v: 1,
      supabase: { model: "gpt-4.1" },
      ojo: { model: "gpt-4o" },
      enricher: { model: "gpt-4.1-mini", perplexity: "sonar" },
      memo: { model: "gpt-4o", perplexity: "sonar" },
    });
    expect(cfg).toEqual({
      v: 1,
      enricher: { model: "gpt-4.1-mini" },
      embeddings: DEFAULT_MODELS_CONFIG.embeddings,
      memo: { model: "gpt-4o" },
    });
  });

  it("is idempotent, so a save never drifts a value it did not touch", () => {
    const raw = { enricher: { model: "gpt-4.1" }, memo: { model: "x-1" } };
    const once = coerceModelsConfig(raw);
    expect(coerceModelsConfig(once)).toEqual(once);
  });
});

describe("withMemo", () => {
  it("changes Memo's model and leaves every other key byte-equal", () => {
    const cfg = coerceModelsConfig({
      enricher: { model: "gpt-4.1-mini" },
      embeddings: { model: "text-embedding-3-large" },
    });
    const next = withMemo(cfg, { model: "gpt-4o" });
    expect(next.memo).toEqual({ ...cfg.memo, model: "gpt-4o" });
    const { memo: _a, ...restBefore } = cfg;
    const { memo: _b, ...restAfter } = next;
    expect(JSON.stringify(restAfter)).toBe(JSON.stringify(restBefore));
  });
});

describe("changedEnricherFields", () => {
  it("is empty when nothing changed", () => {
    expect(changedEnricherFields(ENRICHER, { ...ENRICHER })).toEqual({});
  });

  it("carries only the changed field", () => {
    expect(
      changedEnricherFields(ENRICHER, { ...ENRICHER, perplexityPreset: "deep-research" }),
    ).toEqual({ perplexityPreset: "deep-research" });
  });
});

describe("runSave", () => {
  const savedModels = coerceModelsConfig(null);
  const nextModels: ModelsConfig = withMemo(savedModels, { model: "gpt-5.6-luna" });
  const nextEnricher: EnricherModelSettings = { ...ENRICHER, perplexityPreset: "deep-research" };

  it("saves nothing when nothing changed", async () => {
    const updateModels = vi.fn();
    const updateEnricher = vi.fn();
    const out = await runSave(
      { savedModels, nextModels: savedModels, savedEnricher: ENRICHER, nextEnricher: ENRICHER },
      { updateModels, updateEnricher },
    );
    expect(updateModels).not.toHaveBeenCalled();
    expect(updateEnricher).not.toHaveBeenCalled();
    expect(out.modelsSaved || out.enricherSaved).toBe(false);
  });

  it("saves both halves and returns both new baselines", async () => {
    const out = await runSave(
      { savedModels, nextModels, savedEnricher: ENRICHER, nextEnricher },
      {
        updateModels: async (cfg) => ({ ok: true, data: cfg }),
        updateEnricher: async (patch) => ({ ok: true, data: { ...ENRICHER, ...patch } }),
      },
    );
    expect(out.savedModels.memo.model).toBe("gpt-5.6-luna");
    expect(out.savedEnricher.perplexityPreset).toBe("deep-research");
    expect(out.modelsError ?? out.enricherError).toBeNull();
  });

  it("still saves the Enricher when the models half fails", async () => {
    const updateEnricher = vi.fn(async (patch: Partial<EnricherModelSettings>) => ({
      ok: true as const,
      data: { ...ENRICHER, ...patch },
    }));
    const out = await runSave(
      { savedModels, nextModels, savedEnricher: ENRICHER, nextEnricher },
      { updateModels: async () => ({ ok: false, error: "boom" }), updateEnricher },
    );
    expect(updateEnricher).toHaveBeenCalledWith({ perplexityPreset: "deep-research" });
    expect(out.modelsError).toBe("boom");
    expect(out.savedModels).toBe(savedModels);
    expect(out.enricherSaved).toBe(true);
    expect(out.savedEnricher.perplexityPreset).toBe("deep-research");
  });

  it("keeps the models baseline when only the Enricher half fails", async () => {
    const out = await runSave(
      { savedModels, nextModels, savedEnricher: ENRICHER, nextEnricher },
      {
        updateModels: async (cfg) => ({ ok: true, data: cfg }),
        updateEnricher: async () => ({ ok: false, error: "nope" }),
      },
    );
    expect(out.modelsSaved).toBe(true);
    expect(out.savedModels.memo.model).toBe("gpt-5.6-luna");
    expect(out.enricherError).toBe("nope");
    expect(out.savedEnricher).toBe(ENRICHER);
  });
});
