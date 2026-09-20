import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const client = readFileSync(
  join(__dirname, "ModelsConfigClient.tsx"),
  "utf8",
);
const actions = readFileSync(join(__dirname, "actions.ts"), "utf8");

describe("Models page owns Enricher model knobs", () => {
  it("renders editable Enricher tiers and saves atlas_* via enricher EF", () => {
    expect(client).toContain("title=\"Enricher\"");
    expect(client).toContain("QualityPicker");
    expect(client).toContain("ENRICHER_PERPLEXITY_PRESETS");
    expect(client).toContain("text-embedding-3-small");
    expect(client).toContain("updateEnricherModelSettings");
    expect(client).toContain("updateModelsConfig");
    expect(client).not.toContain(
      "Enricher quality tiers and the embedding model live on Crenup",
    );
  });

  it("loads and writes Enricher settings through dedicated actions", () => {
    expect(actions).toContain("getEnricherModelSettings");
    expect(actions).toContain("updateEnricherModelSettings");
    expect(actions).toContain("updateAtlasConfig");
  });
});
