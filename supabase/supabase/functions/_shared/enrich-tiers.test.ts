// MESITA-2126 — the Enricher has TWO quality tiers, and the admin Models page
// names their models.
//
// 1. A stored "high" (the retired third tier, same gpt-4o as "standard") must
//    keep running gpt-4o after the read normalizer, never fall to the cheap
//    default — that would silently downgrade every place.
// 2. QUALITY_MODEL.economy stays the code-default enricher model, so the photos
//    row's "cheaper option uses the sorting model" stays true by default.
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

Deno.test("a stored high reads as standard and still runs gpt-4o", () => {
  const cfg = normalizeEnrichmentConfig({
    enrichSynthesisQuality: "high",
    enrichVisionQuality: "high",
  });
  assertEquals(cfg.enrichSynthesisQuality, "standard");
  assertEquals(cfg.enrichVisionQuality, "standard");
  assertEquals(synthesisModelFor(cfg.enrichSynthesisQuality), "gpt-4o");
  assertEquals(visionModelFor(cfg.enrichVisionQuality), "gpt-4o");
});

Deno.test("an unknown tier still falls back to economy", () => {
  const cfg = normalizeEnrichmentConfig({ enrichSynthesisQuality: "ultra" });
  assertEquals(cfg.enrichSynthesisQuality, "economy");
});

Deno.test("two tiers, and economy is the default enricher model", () => {
  assertEquals(Object.keys(QUALITY_MODEL).sort(), ["economy", "standard"]);
  assertEquals(QUALITY_MODEL.economy, DEFAULT_MODELS_CONFIG.enricher.model);
});

Deno.test("the admin Models page names the same model for each tier", async () => {
  const src = await Deno.readTextFile(ADMIN_TYPES);
  const block = src.match(/ENRICHER_TIER_MODELS[^=]*=\s*\{([\s\S]*?)\}/)?.[1];
  assert(block, "ENRICHER_TIER_MODELS not found in the admin lib/synthesis-quality.ts");
  const pairs = [...block.matchAll(/(\w+):\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]);
  assert(pairs.length >= 2, "parsed fewer than two tiers — the pin would pass vacuously");
  assertEquals(Object.fromEntries(pairs), QUALITY_MODEL);
});
