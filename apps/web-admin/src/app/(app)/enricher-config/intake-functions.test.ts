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
  it("is twelve, Seed through Summary, Name before Summary", () => {
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
      "name",
      "summary",
    ]);
  });

  it("Create is Seed · Pulse · Details · Semantics; Enrich is 1–10", () => {
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
      "9 Description",
      "10 Semantics",
    ]);
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
    expect(flowTagFor("name")).toBe("Create + Enrich");
  });
});

describe("Create and Enrich boxes pin live estimates", () => {
  it("renders a FlowEstimate on both instances", () => {
    const src = readFileSync(join(__dirname, "IntakeClient.tsx"), "utf8");
    expect(src.match(/FlowEstimate/g)?.length).toBeGreaterThanOrEqual(2);
    expect(src).toContain("computeCreateCost");
    expect(src).toContain("computeEnrichTickCost");
    expect(src).not.toContain("type=\"number\"");
  });

  it("does not restack Create and Enrich as family boxes on Functions", () => {
    const src = readFileSync(join(__dirname, "IntakeClient.tsx"), "utf8");
    expect(src).not.toContain("FunctionFamily");
    expect(src).not.toContain("12 modules");
    expect(src).not.toContain("Create explained");
  });
});
