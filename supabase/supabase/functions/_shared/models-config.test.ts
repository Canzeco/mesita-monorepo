import { assertEquals } from "jsr:@std/assert@1";
import {
  DEFAULT_MODELS_CONFIG,
  loadModelsConfig,
  type ModelsConfig,
} from "./models-config.ts";

Deno.test("DEFAULT_MODELS_CONFIG covers every Models page subsystem", () => {
  assertEquals(typeof DEFAULT_MODELS_CONFIG.supabase.model, "string");
  assertEquals(typeof DEFAULT_MODELS_CONFIG.enricher.model, "string");
  assertEquals(typeof DEFAULT_MODELS_CONFIG.enricher.perplexity, "string");
  assertEquals(typeof DEFAULT_MODELS_CONFIG.embeddings.model, "string");
  assertEquals(typeof DEFAULT_MODELS_CONFIG.memo.model, "string");
  assertEquals(typeof DEFAULT_MODELS_CONFIG.memo.perplexity, "string");
});

Deno.test("DEFAULT_MODELS_CONFIG uses live product defaults", () => {
  assertEquals(DEFAULT_MODELS_CONFIG.supabase.model, "gpt-4o-mini");
  assertEquals(DEFAULT_MODELS_CONFIG.enricher.model, "gpt-4o-mini");
  assertEquals(
    DEFAULT_MODELS_CONFIG.embeddings.model,
    "text-embedding-3-small",
  );
  assertEquals(DEFAULT_MODELS_CONFIG.memo.perplexity, "sonar-pro");
});

/** Minimal stand-in for the one query `loadModelsConfig` runs. */
// deno-lint-ignore no-explicit-any
function clientReturning(models_config: ModelsConfig | null): any {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { models_config }, error: null }),
        }),
      }),
    }),
  };
}

// ── The MESITA-1216 rename guard ───────────────────────────────────────────
//
// `embeddings` was `lineup`. This is a JSONB blob, so a row written before the
// rename still carries the old key — and the failure mode of dropping the
// fallback is SILENT: every place falls back to the code default, which is a
// model swap nobody asked for and nothing surfaces until the vectors disagree.
// These three pin the resolution order so the fallback cannot be deleted by a
// later tidy-up without a red test.

Deno.test("embeddingModel: reads the new `embeddings` key", async () => {
  const cfg = await loadModelsConfig(
    clientReturning({ embeddings: { model: "text-embedding-3-large" } }),
  );
  assertEquals(cfg.embeddingModel, "text-embedding-3-large");
});

Deno.test("embeddingModel: falls back to the legacy `lineup` key", async () => {
  const cfg = await loadModelsConfig(
    clientReturning({ lineup: { model: "text-embedding-ada-002" } }),
  );
  assertEquals(cfg.embeddingModel, "text-embedding-ada-002");
});

Deno.test("embeddingModel: `embeddings` wins when a blob carries both", async () => {
  const cfg = await loadModelsConfig(
    clientReturning({
      embeddings: { model: "text-embedding-3-large" },
      lineup: { model: "text-embedding-ada-002" },
    }),
  );
  assertEquals(cfg.embeddingModel, "text-embedding-3-large");
});

Deno.test("embeddingModel: neither key present → the product default", async () => {
  const cfg = await loadModelsConfig(clientReturning({}));
  assertEquals(cfg.embeddingModel, "text-embedding-3-small");
});
