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
  it("is eleven, Seed through Semantic", () => {
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

  it("Create is 1–4; Enrich is 1–10 — two sequences, not one enum", () => {
    expect(chipsFor("create").map((c) => c.label)).toEqual([
      "1 Seed",
      "2 Pulse",
      "3 Details",
      "4 Semantic",
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
      "9 Description",
      "10 Semantic",
    ]);
  });

  it("Pulse is 2 on Create and 1 on Enrich; Semantic is 4 and 10", () => {
    const create = chipsFor("create").map((c) => c.label);
    const enrich = chipsFor("enrich").map((c) => c.label);
    expect(create[1]).toBe("2 Pulse");
    expect(enrich[0]).toBe("1 Pulse");
    expect(create[3]).toMatch(/^4 Semantic/);
    expect(enrich[9]).toMatch(/^10 Semantic/);
    expect(create[0]).toBe("1 Seed");
    expect(create.some((l) => l.startsWith("0 "))).toBe(false);
    expect(create.some((l) => l.startsWith("10 "))).toBe(false);
  });

  it("Seed is Create-only; numbered 3–9 of Enrich are Enrich-only", () => {
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
    const blocks = readFileSync(join(__dirname, "blocks.tsx"), "utf8");
    expect(blocks).toContain("whitespace-nowrap");
    expect(blocks).toContain("<details");
    expect(blocks).toContain("Breakdown");
  });

  it("does not restack Create and Enrich as family boxes on Functions", () => {
    const src = readFileSync(join(__dirname, "IntakeClient.tsx"), "utf8");
    expect(src).not.toContain("FunctionFamily");
    expect(src).not.toContain("12 modules");
    expect(src).not.toContain("Create explained");
    expect(src).toContain("f-semantic");
    expect(src).not.toContain("id=\"f-name\"");
    expect(src).not.toContain("id=\"f-summary\"");
    expect(src).toMatch(/id="f-seed"\s+index="·"/);
    expect(src).not.toContain("index=\"0\"");
    expect(src).not.toContain("index=\"SEED\"");
    expect(src).not.toMatch(/id="f-seed"\s+index="1"/);
  });
});

describe("Name and Summary share Semantic", () => {
  it("is one chip, never two Name/Summary pills", () => {
    const names = INTAKE_SUBFUNCTIONS.map((s) => s.name);
    expect(names).toContain("Semantic");
    expect(names).not.toContain("Name");
    expect(names).not.toContain("Summary");
    expect(names.filter((n) => n === "Name" || n === "Summary")).toEqual([]);
  });
});
