import { assertEquals } from "jsr:@std/assert@1";
import { DEFAULT_MODELS_CONFIG } from "./models-config.ts";

Deno.test("DEFAULT_MODELS_CONFIG covers every Models page subsystem", () => {
  assertEquals(typeof DEFAULT_MODELS_CONFIG.supabase.model, "string");
  assertEquals(typeof DEFAULT_MODELS_CONFIG.enricher.model, "string");
  assertEquals(typeof DEFAULT_MODELS_CONFIG.enricher.perplexity, "string");
  assertEquals(typeof DEFAULT_MODELS_CONFIG.lineup.model, "string");
  assertEquals(typeof DEFAULT_MODELS_CONFIG.memo.model, "string");
  assertEquals(typeof DEFAULT_MODELS_CONFIG.memo.perplexity, "string");
});

Deno.test("DEFAULT_MODELS_CONFIG uses live product defaults", () => {
  assertEquals(DEFAULT_MODELS_CONFIG.supabase.model, "gpt-4o-mini");
  assertEquals(DEFAULT_MODELS_CONFIG.enricher.model, "gpt-4o-mini");
  assertEquals(DEFAULT_MODELS_CONFIG.lineup.model, "text-embedding-3-small");
  assertEquals(DEFAULT_MODELS_CONFIG.memo.perplexity, "sonar-pro");
});
