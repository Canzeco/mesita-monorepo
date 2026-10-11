import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Wiring only: what the page renders is pinned by the render test, and the
// save logic by runSave in types.test.ts.
const client = readFileSync(join(__dirname, "ModelsConfigClient.tsx"), "utf8");
const actions = readFileSync(join(__dirname, "actions.ts"), "utf8");
const page = readFileSync(join(__dirname, "page.tsx"), "utf8");

describe("Models page wiring (MESITA-2126)", () => {
  it("saves both stores through runSave", () => {
    expect(client).toContain("runSave(");
    expect(client).toContain("updateModels: updateModelsConfig");
    expect(client).toContain("updateEnricher: updateEnricherModelSettings");
  });

  it("loads on the server only, and a failed half arrives as null", () => {
    expect(client).not.toContain("useEffect");
    expect(page).toContain("models.ok ? models.data : null");
    expect(page).toContain("enricher.ok ? enricher.data : null");
  });

  it("sends the Enricher a PATCH and normalizes tiers in both directions", () => {
    expect(actions).toContain("updateAtlasConfig(patch)");
    expect(actions).toContain("normalizeTier(d.atlasSynthesisQuality)");
    expect(actions).toContain("normalizeTier(d.atlasVisionQuality)");
  });
});
