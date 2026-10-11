import { describe, expect, it, vi } from "vitest";
import {
  changedEnricherFields,
  coerceModelsConfig,
  DEFAULT_MODELS_CONFIG,
  nextRadioIndex,
  runSave,
  tierChoice,
  withMemo,
  type EnricherModelSettings,
  type ModelsConfig,
} from "./types";

const ENRICHER: EnricherModelSettings = {
  synthesisQuality: "economy",
  visionQuality: "economy",
  perplexityPreset: "pro-search",
};

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

  it("is idempotent, so a save never drifts a value it did not touch", () => {
    const raw = { supabase: { model: "gpt-4.1" }, ojo: { model: "gpt-4o" }, memo: { model: "x-1" } };
    const once = coerceModelsConfig(raw);
    expect(coerceModelsConfig(once)).toEqual(once);
  });
});

describe("withMemo", () => {
  it("changes Memo's picks and leaves every other key byte-equal", () => {
    const cfg = coerceModelsConfig({
      supabase: { model: "gpt-4.1" },
      ojo: { model: "gpt-4o" },
      enricher: { model: "gpt-4.1-mini", perplexity: "sonar" },
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

  it("never re-sends an untouched tier (a stored high arrives as standard on both sides)", () => {
    const saved = { ...ENRICHER, synthesisQuality: "standard" as const };
    expect(
      changedEnricherFields(saved, { ...saved, perplexityPreset: "fast-search" }),
    ).toEqual({ perplexityPreset: "fast-search" });
  });
});

describe("tierChoice", () => {
  it("names writing's two models with their price per place", () => {
    const c = tierChoice("writing", "gpt-4o-mini");
    expect(c).toEqual({
      kind: "choice",
      options: [
        { tier: "economy", label: "gpt-4o-mini · ~$0.002 per place" },
        { tier: "standard", label: "gpt-4o · ~$0.028 per place" },
      ],
    });
  });

  it("names photos' cheaper option after the live sorting model", () => {
    const c = tierChoice("photos", "gpt-4o-mini");
    expect(c.kind === "choice" && c.options.map((o) => o.label)).toEqual([
      "gpt-4o-mini · ~$0.001 per photo",
      "gpt-4o · ~$0.008 per photo",
    ]);
  });

  it("gives a swapped-in sorting model no borrowed price", () => {
    const c = tierChoice("photos", "gpt-4.1-mini");
    expect(c.kind === "choice" && c.options[0].label).toBe("gpt-4.1-mini");
  });

  it("says there is no choice when both options run the same model", () => {
    expect(tierChoice("photos", "gpt-4o")).toEqual({ kind: "same", model: "gpt-4o" });
  });
});

describe("nextRadioIndex", () => {
  it("moves and wraps with the arrow keys", () => {
    expect(nextRadioIndex("ArrowRight", 0, 2)).toBe(1);
    expect(nextRadioIndex("ArrowRight", 1, 2)).toBe(0);
    expect(nextRadioIndex("ArrowLeft", 0, 2)).toBe(1);
    expect(nextRadioIndex("ArrowDown", 0, 2)).toBe(1);
    expect(nextRadioIndex("ArrowUp", 1, 2)).toBe(0);
  });
  it("jumps with Home/End and ignores other keys", () => {
    expect(nextRadioIndex("Home", 1, 2)).toBe(0);
    expect(nextRadioIndex("End", 0, 2)).toBe(1);
    expect(nextRadioIndex("Enter", 0, 2)).toBeNull();
    expect(nextRadioIndex("ArrowRight", 0, 0)).toBeNull();
  });
});

describe("runSave", () => {
  const savedModels = coerceModelsConfig(null);
  const nextModels: ModelsConfig = withMemo(savedModels, { model: "gpt-4o" });
  const nextEnricher: EnricherModelSettings = { ...ENRICHER, visionQuality: "standard" };

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
    expect(out.savedModels.memo.model).toBe("gpt-4o");
    expect(out.savedEnricher.visionQuality).toBe("standard");
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
    expect(updateEnricher).toHaveBeenCalledWith({ visionQuality: "standard" });
    expect(out.modelsError).toBe("boom");
    expect(out.savedModels).toBe(savedModels);
    expect(out.enricherSaved).toBe(true);
    expect(out.savedEnricher.visionQuality).toBe("standard");
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
    expect(out.savedModels.memo.model).toBe("gpt-4o");
    expect(out.enricherError).toBe("nope");
    expect(out.savedEnricher).toBe(ENRICHER);
  });
});
