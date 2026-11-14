// MESITA-3966 — the Enricher has ONE quality tier, efficient (gpt-6-luna), and
// the admin Models page names its model.
//
// 1. A stored retired tier (economy, standard, high) reads as efficient and
//    runs gpt-6-luna; gpt-4o and gpt-4o-mini are gone (OpenAI shuts both down
//    on 2027-01-14).
// 2. QUALITY_MODEL.efficient is the code-default enricher model.
// 3. The admin page copies the tier→model map as ENRICHER_TIER_MODELS; this
//    pins the copy from this side (web-admin pins it from its side too, because
//    each package's CI only runs when its own folder changes).
import { assert, assertEquals } from "jsr:@std/assert@1";
import { QUALITY_MODEL, visionModelFor } from "./enrich-config.ts";
import { normalizeEnrichmentConfig } from "./enrichment-config.ts";
import { synthesisModelFor } from "./enrich-synthesis.ts";
import { DEFAULT_MODELS_CONFIG } from "./models-config.ts";

const ADMIN_TYPES = new URL(
  "../../../../apps/web-admin/src/lib/synthesis-quality.ts",
  import.meta.url,
);

Deno.test("every stored tier, retired or unknown, reads as efficient and runs gpt-6-luna", () => {
  for (const q of ["economy", "standard", "high", "ultra"]) {
    const cfg = normalizeEnrichmentConfig({ enrichSynthesisQuality: q, enrichVisionQuality: q });
    assertEquals(cfg.enrichSynthesisQuality, "efficient");
    assertEquals(cfg.enrichVisionQuality, "efficient");
    assertEquals(synthesisModelFor(cfg.enrichSynthesisQuality), "gpt-6-luna");
    assertEquals(visionModelFor(cfg.enrichVisionQuality), "gpt-6-luna");
  }
});

Deno.test("one tier, and it is the default enricher model", () => {
  assertEquals(Object.keys(QUALITY_MODEL), ["efficient"]);
  assertEquals(QUALITY_MODEL.efficient, DEFAULT_MODELS_CONFIG.enricher.model);
});

Deno.test("the admin Models page names the same model for each tier", async () => {
  const src = await Deno.readTextFile(ADMIN_TYPES);
  const block = src.match(/ENRICHER_TIER_MODELS[^=]*=\s*\{([\s\S]*?)\}/)?.[1];
  assert(block, "ENRICHER_TIER_MODELS not found in the admin lib/synthesis-quality.ts");
  const pairs = [...block.matchAll(/(\w+):\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]);
  assert(pairs.length >= 1, "parsed no tier — the pin would pass vacuously");
  assertEquals(Object.fromEntries(pairs), QUALITY_MODEL);
});
