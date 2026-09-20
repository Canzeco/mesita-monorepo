import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  chipsFor,
  flowTag,
  flowTagFor,
  CRENUP_STEP_SPECS,
} from "./crenup-steps";

describe("crenup steps", () => {
  it("is nine, Seed through Embedding", () => {
    expect(CRENUP_STEP_SPECS.map((s) => s.key)).toEqual([
      "seed",
      "details",
      "serp",
      "links",
      "social",
      "reviews",
      "images",
      "description",
      "embedding",
    ]);
  });

  it("ONE ladder: the number is the step's, not the flow's", () => {
    // The whole point of MESITA-2027. `details` is 1 to BOTH callers; Create
    // simply runs a subset (0, 1, 7, 8). Before this, Create numbered itself
    // from 1 by position and called the same step 3.
    expect(chipsFor("create").map((c) => c.label)).toEqual([
      "0 Seed",
      "1 Details",
      "7 Description",
      "8 Embedding",
    ]);
    expect(chipsFor("enrich").map((c) => c.label)).toEqual([
      "1 Details",
      "2 Serp",
      "3 Links",
      "4 Social",
      "5 Reviews",
      "6 Images",
      "7 Description",
      "8 Embedding",
    ]);
  });

  it("a shared step carries ONE number in both flows", () => {
    const numberIn = (flow: "create" | "enrich", key: string) =>
      chipsFor(flow).find((c) => c.href === `#f-${key}`)?.number ?? null;
    for (const key of ["details", "description", "embedding"]) {
      expect(numberIn("create", key)).toBe(numberIn("enrich", key));
    }
    // Seed is 0 and Create-only; nothing renders it as a 1 any more.
    expect(chipsFor("create")[0]).toMatchObject({ number: 0, name: "Seed" });
    expect(chipsFor("enrich").some((c) => c.number === 0)).toBe(false);
  });

  it("Pulse and Menu are not steps any more", () => {
    // Liveness is a subprocess of Details; the menu is operator input the
    // Enricher never derived. Both were rungs until MESITA-2027.
    const keys = CRENUP_STEP_SPECS.map((s) => s.key);
    expect(keys).not.toContain("pulse");
    expect(keys).not.toContain("menu");
    expect(() => flowTagFor("pulse")).toThrow();
    expect(() => flowTagFor("menu")).toThrow();
  });

  it("Seed is Create-only; the gathers are Enrich-only", () => {
    expect(flowTag(["create"])).toBe("Create");
    expect(flowTag(["enrich"])).toBe("Enrich");
    expect(flowTag(["create", "enrich"])).toBe("Create + Enrich");
    expect(CRENUP_STEP_SPECS.find((s) => s.key === "seed")?.flows).toEqual([
      "create",
    ]);
    expect(CRENUP_STEP_SPECS.find((s) => s.key === "serp")?.flows).toEqual([
      "enrich",
    ]);
    expect(flowTagFor("seed")).toBe("Create");
    expect(flowTagFor("details")).toBe("Create + Enrich");
    expect(flowTagFor("reviews")).toBe("Enrich");
    expect(flowTagFor("description")).toBe("Create + Enrich");
    expect(flowTagFor("embedding")).toBe("Create + Enrich");
  });
});

describe("Create and Enrich boxes pin live estimates", () => {
  it("renders a FlowEstimate on both instances", () => {
    const src = readFileSync(join(__dirname, "CrenupClient.tsx"), "utf8");
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
    const src = readFileSync(join(__dirname, "CrenupClient.tsx"), "utf8");
    expect(src).not.toContain("FunctionFamily");
    expect(src).not.toContain("12 modules");
    expect(src).not.toContain("Create explained");
    expect(src).toContain("f-embedding");
    expect(src).not.toContain("id=\"f-name\"");
    expect(src).not.toContain("id=\"f-summary\"");
    // Seed is STEP 0 now, not an unnumbered dot beside a Create-1.
    expect(src).toMatch(/id="f-seed"\s+index="0"/);
    expect(src).not.toContain("index=\"·\"");
    // The retired rungs left the screen with the ladder.
    expect(src).not.toContain("f-pulse");
    expect(src).not.toContain("f-menu");
    expect(src).not.toContain("index=\"SEED\"");
    expect(src).not.toMatch(/id="f-seed"\s+index="1"/);
  });
});

describe("Name and Summary share Embedding", () => {
  it("is one chip, never two Name/Summary pills", () => {
    const names = CRENUP_STEP_SPECS.map((s) => s.name);
    expect(names).toContain("Embedding");
    expect(names).not.toContain("Semantic");
    expect(names).not.toContain("Name");
    expect(names).not.toContain("Summary");
    expect(names.filter((n) => n === "Name" || n === "Summary")).toEqual([]);
  });
});
