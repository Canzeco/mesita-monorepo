import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { PIPELINE_STEPS } from "./pipeline";

const here = dirname(fileURLToPath(import.meta.url));

describe("PIPELINE_STEPS", () => {
  it("is Google Search, Mesita Search, Mesita Intake, Edit", () => {
    expect(PIPELINE_STEPS.map((s) => s.label)).toEqual([
      "Google Search",
      "Mesita Search",
      "Mesita Intake",
      "Edit",
    ]);
    expect(PIPELINE_STEPS.map((s) => s.n)).toEqual([1, 2, 3, 4]);
    expect(new Set(PIPELINE_STEPS.map((s) => s.id)).size).toBe(4);
  });
});

describe("the page chrome names the four surfaces", () => {
  it("keeps Google Search, Mesita Search, Mesita Intake, and Edit", () => {
    const client = readFileSync(join(here, "MultiplePlacesClient.tsx"), "utf8");
    const intake = readFileSync(join(here, "IntakeTab.tsx"), "utf8");
    const edit = readFileSync(join(here, "EditTab.tsx"), "utf8");
    expect(client).toContain("SearchTab");
    expect(client).toContain("MesitaSearchTab");
    expect(client).toContain("IntakeTab");
    expect(client).toContain("EditTab");
    expect(intake).toContain("Re-enrich from zero");
    expect(intake).toContain("alreadyExisted");
    expect(edit).toContain("Listed");
    expect(edit).toContain("Verified");
    expect(edit).toContain("Partner");
    expect(edit).toContain("Promoting");
  });
});

describe("spend calculator stays off this page", () => {
  it("does not mount CostCalculator — Create/Enrich estimates live on Intake", () => {
    const params = readFileSync(join(here, "SearchParametersSection.tsx"), "utf8");
    const searchTab = readFileSync(join(here, "SearchTab.tsx"), "utf8");
    const intakeTab = readFileSync(join(here, "IntakeTab.tsx"), "utf8");
    const costUi = readFileSync(join(here, "search-cost.tsx"), "utf8");
    expect(params).not.toContain("CostCalculator");
    expect(searchTab).not.toContain("CostCalculator");
    expect(intakeTab).not.toContain("computeEnrichmentCost");
    expect(intakeTab).not.toContain("costSeed");
    expect(costUi).not.toContain("export function CostCalculator");
  });
});
