import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { PIPELINE_STEPS } from "./pipeline";

const here = dirname(fileURLToPath(import.meta.url));

describe("PIPELINE_STEPS", () => {
  it("is Create, Enrich, Create + Enrich — the page must show all three", () => {
    expect(PIPELINE_STEPS.map((s) => s.label)).toEqual([
      "Create",
      "Enrich",
      "Create + Enrich",
    ]);
    expect(PIPELINE_STEPS.map((s) => s.n)).toEqual([1, 2, 3]);
    expect(new Set(PIPELINE_STEPS.map((s) => s.id)).size).toBe(3);
  });
});

describe("spend calculator stays off this page", () => {
  it("does not mount CostCalculator — Create/Enrich estimates live on Intake", () => {
    const params = readFileSync(join(here, "SearchParametersSection.tsx"), "utf8");
    const searchTab = readFileSync(join(here, "SearchTab.tsx"), "utf8");
    const enrichTab = readFileSync(join(here, "EnrichTab.tsx"), "utf8");
    const costUi = readFileSync(join(here, "search-cost.tsx"), "utf8");
    expect(params).not.toContain("CostCalculator");
    expect(searchTab).not.toContain("CostCalculator");
    expect(enrichTab).not.toContain("computeEnrichmentCost");
    expect(enrichTab).not.toContain("costSeed");
    expect(costUi).not.toContain("export function CostCalculator");
  });
});
