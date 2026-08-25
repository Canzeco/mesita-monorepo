import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { PIPELINE_STEPS } from "./pipeline";

const here = dirname(fileURLToPath(import.meta.url));

describe("PIPELINE_STEPS", () => {
  it("is Search, Create, Enrich — the page must show all three", () => {
    expect(PIPELINE_STEPS.map((s) => s.label)).toEqual([
      "Search",
      "Create",
      "Enrich",
    ]);
    expect(PIPELINE_STEPS.map((s) => s.n)).toEqual([1, 2, 3]);
    expect(new Set(PIPELINE_STEPS.map((s) => s.id)).size).toBe(3);
    expect(PIPELINE_STEPS.map((s) => s.label).join(" ")).not.toMatch(
      /Create \+ Enrich/,
    );
  });
});

describe("the page chrome never names a Create + Enrich box", () => {
  it("keeps Search as its own step", () => {
    const client = readFileSync(join(here, "MultiplePlacesClient.tsx"), "utf8");
    const layout = readFileSync(join(here, "layout.tsx"), "utf8");
    const nav = readFileSync(join(here, "PipelineNav.tsx"), "utf8");
    const create = readFileSync(join(here, "CreateTab.tsx"), "utf8");
    for (const src of [client, layout, nav, create]) {
      expect(src).not.toMatch(/Create \+ Enrich/);
    }
    expect(client).toContain("SearchTab");
    expect(client).toContain("CreateTab");
    expect(client).toContain("EnrichTab");
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
