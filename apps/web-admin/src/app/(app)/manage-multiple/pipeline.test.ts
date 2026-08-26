import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { LEGACY_HASHES, PIPELINE_STEPS } from "./pipeline";

const here = dirname(fileURLToPath(import.meta.url));

describe("PIPELINE_STEPS", () => {
  it("is Google Search, Mesita Search, Mesita Intake", () => {
    expect(PIPELINE_STEPS.map((s) => s.label)).toEqual([
      "Google Search",
      "Mesita Search",
      "Mesita Intake",
    ]);
    expect(PIPELINE_STEPS.map((s) => s.n)).toEqual([1, 2, 3]);
    expect(new Set(PIPELINE_STEPS.map((s) => s.id)).size).toBe(3);
  });

  it("routes the retired Edit hash onto Mesita Intake", () => {
    expect(LEGACY_HASHES["edit-states"]).toBe("mesita-intake");
  });
});

describe("the page chrome names the three surfaces", () => {
  it("keeps Google Search, Mesita Search, Mesita Intake, with Edit on Intake", () => {
    const client = readFileSync(join(here, "MultiplePlacesClient.tsx"), "utf8");
    const intake = readFileSync(join(here, "IntakeTab.tsx"), "utf8");
    const edit = readFileSync(join(here, "EditTab.tsx"), "utf8");
    expect(client).toContain("SearchTab");
    expect(client).toContain("MesitaSearchTab");
    expect(client).toContain("IntakeTab");
    expect(client).not.toContain("EditTab");
    expect(intake).toContain("EditPanel");
    expect(intake).toContain("alreadyExisted");
    expect(intake).toContain("Listed · Verified · Partner · Promoted");
    expect(intake).not.toContain("Promoting");
    expect(edit).toContain("Listed");
    expect(edit).toContain("Verified");
    expect(edit).toContain("Partner");
    expect(edit).toContain("Promoted");
    expect(edit).toContain('value="promoting"');
    expect(edit).toContain("<option value=\"promoting\">Promoted</option>");
    expect(edit).not.toContain(">Promoting<");
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

describe("Google quality floors are not authored here", () => {
  it("Google Search has no per-run rating or review knobs", () => {
    const params = readFileSync(join(here, "SearchParametersSection.tsx"), "utf8");
    const searchTab = readFileSync(join(here, "SearchTab.tsx"), "utf8");
    const constants = readFileSync(join(here, "search-tab-constants.ts"), "utf8");
    expect(params).not.toContain("minRating");
    expect(params).not.toContain("minReviews");
    expect(params).toContain("/enricher-config#s-sourcing");
    expect(searchTab).not.toContain("minRating");
    expect(searchTab).not.toContain("minUserRatingCount");
    expect(constants).not.toContain("RATING_OPTIONS");
    expect(constants).not.toContain("REVIEW_OPTIONS");
  });
});
