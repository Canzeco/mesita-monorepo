import { assertEquals } from "jsr:@std/assert@1";
import { loadModelsConfig, type ModelsConfig } from "./models-config.ts";

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

Deno.test("embeddingModel: reads the `embeddings` key", async () => {
  const cfg = await loadModelsConfig(
    clientReturning({ embeddings: { model: "text-embedding-3-large" } }),
  );
  assertEquals(cfg.embeddingModel, "text-embedding-3-large");
});

Deno.test("embeddingModel: no `embeddings` key → the product default", async () => {
  const cfg = await loadModelsConfig(clientReturning({}));
  assertEquals(cfg.embeddingModel, "text-embedding-3-small");
});
