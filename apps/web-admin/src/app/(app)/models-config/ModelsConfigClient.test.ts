import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const client = readFileSync(
  join(__dirname, "ModelsConfigClient.tsx"),
  "utf8",
);
const actions = readFileSync(join(__dirname, "actions.ts"), "utf8");

describe("Models page owns Intaker model knobs", () => {
  it("renders editable Intaker tiers and saves atlas_* via enricher EF", () => {
    expect(client).toContain("title=\"Intaker\"");
    expect(client).toContain("QualityPicker");
    expect(client).toContain("INTAKER_PERPLEXITY_PRESETS");
    expect(client).toContain("text-embedding-3-small");
    expect(client).toContain("updateIntakerModelSettings");
    expect(client).toContain("updateModelsConfig");
    expect(client).not.toContain(
      "Intaker quality tiers and the embedding model live on Intake",
    );
  });

  it("loads and writes Intaker settings through dedicated actions", () => {
    expect(actions).toContain("getIntakerModelSettings");
    expect(actions).toContain("updateIntakerModelSettings");
    expect(actions).toContain("updateAtlasConfig");
  });
});
