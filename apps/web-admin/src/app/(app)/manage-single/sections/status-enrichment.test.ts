import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { intakeFunctionRows } from "./status-enrichment";

describe("intakeFunctionRows", () => {
  it("lists eleven functions 0–10 as called/not called", () => {
    const rows = intakeFunctionRows(
      {
        pulse: { status: "completed", at: null, detail: null },
        details: { status: "failed", at: null, detail: "no" },
        semantic: { status: "completed", at: null, detail: null },
      },
      true,
    );
    expect(rows.map((r) => r.key)).toEqual([
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
    expect(rows.map((r) => r.label)).toEqual([
      "0 Seed",
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
    expect(rows[0]?.on).toBe(true);
    expect(rows[1]?.on).toBe(true);
    expect(rows[2]?.on).toBe(true);
    expect(rows[3]?.on).toBe(false);
    expect(rows[10]?.on).toBe(true);
  });
});

describe("StatusCard source", () => {
  it("keeps Enriched a bool and lists Intake as eleven chips", () => {
    const src = readFileSync(join(__dirname, "StatusCard.tsx"), "utf8");
    expect(src).toContain("intakeFunctionRows");
    expect(src).toContain("enrich_functions");
    expect(src).not.toContain("chipLabel={pulse === null");
    expect(src).toContain('name="Enriched"');
    expect(src).toContain("Intake");
  });

  it("AdminSection does not mount Create or Enrich status boxes", () => {
    const src = readFileSync(join(__dirname, "AdminSection.tsx"), "utf8");
    expect(src).toContain("<StatusCard");
    expect(src).not.toContain("CreateStatusCard");
    expect(src).not.toContain("EnrichStatusCard");
    expect(src).not.toContain("IntakeStatusCards");
  });
});
