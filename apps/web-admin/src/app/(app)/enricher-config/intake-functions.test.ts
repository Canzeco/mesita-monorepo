import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  chipsFor,
  flowTag,
  flowTagFor,
  INTAKE_SUBFUNCTIONS,
} from "./intake-functions";

describe("intake subfunctions", () => {
  it("is eleven, Seed through Semantics", () => {
    expect(INTAKE_SUBFUNCTIONS.map((s) => s.key)).toEqual([
      "seed",
      "pulse",
      "details",
      "serp",
      "links",
      "social",
      "images",
      "menu",
      "reviews",
      "description",
      "semantic",
    ]);
  });

  it("Create awaits four; Enrich is ten sequential ticks", () => {
    expect(chipsFor("create").map((c) => c.label)).toEqual([
      "0 Seed",
      "1 Pulse",
      "2 Details",
      "10 Semantics",
    ]);
    expect(chipsFor("enrich").map((c) => c.label)).toEqual([
      "1 Pulse",
      "2 Details",
      "3 Serp",
      "4 Links",
      "5 Social",
      "6 Images",
      "7 Menu",
      "8 Reviews",
      "9 Description (Category, Tags, Presentation)",
      "10 Semantics",
    ]);
  });

  it("numbers every subfunction 0–10", () => {
    expect(
      INTAKE_SUBFUNCTIONS.map((s) => s.chip.match(/^\d+/)?.[0]),
    ).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
  });

  it("Seed is Create-only; numbered 3–9 are Enrich-only", () => {
    expect(flowTag(["create"])).toBe("Create");
    expect(flowTag(["enrich"])).toBe("Enrich");
    expect(flowTag(["create", "enrich"])).toBe("Create + Enrich");
    expect(INTAKE_SUBFUNCTIONS.find((s) => s.key === "seed")?.flows).toEqual([
      "create",
    ]);
    expect(INTAKE_SUBFUNCTIONS.find((s) => s.key === "serp")?.flows).toEqual([
      "enrich",
    ]);
    expect(flowTagFor("seed")).toBe("Create");
    expect(flowTagFor("pulse")).toBe("Create + Enrich");
    expect(flowTagFor("menu")).toBe("Enrich");
    expect(flowTagFor("semantic")).toBe("Create + Enrich");
  });
});

describe("Create and Enrich boxes pin live estimates", () => {
  it("renders a FlowEstimate on both instances", () => {
    const src = readFileSync(join(__dirname, "IntakeClient.tsx"), "utf8");
    expect(src.match(/FlowEstimate/g)?.length).toBeGreaterThanOrEqual(2);
    expect(src).toContain("computeCreateCost");
    expect(src).toContain("computeEnrichTickCost");
    expect(src).not.toContain("type=\"number\"");
    expect(src).not.toContain("× five");
    expect(src).not.toContain("/ 5 places");
  });

  it("does not restack Create and Enrich as family boxes on Functions", () => {
    const src = readFileSync(join(__dirname, "IntakeClient.tsx"), "utf8");
    expect(src).not.toContain("FunctionFamily");
    expect(src).not.toContain("12 modules");
    expect(src).not.toContain("Create explained");
    expect(src).toContain("f-semantic");
    expect(src).not.toContain("id=\"f-name\"");
    expect(src).not.toContain("id=\"f-summary\"");
    expect(src).toContain("index=\"0\"");
    expect(src).not.toContain("index=\"SEED\"");
  });
});

describe("Name and Summary share Semantics", () => {
  it("is one chip, never two Name/Summary pills", () => {
    const labels = INTAKE_SUBFUNCTIONS.map((s) => s.chip);
    expect(labels).toContain("10 Semantics");
    expect(labels).not.toContain("◇ Name");
    expect(labels).not.toContain("◇ Summary");
    expect(labels.filter((l) => /Name|Summary/.test(l))).toEqual([]);
  });
});
