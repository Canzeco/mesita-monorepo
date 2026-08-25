import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createFunctionRows, enrichFunctionRows } from "./status-enrichment";

describe("createFunctionRows", () => {
  it("lists Create 1–4; Seed follows the identity spine, not a seed event", () => {
    const rows = createFunctionRows(
      {
        pulse: { status: "completed", at: null, detail: null },
        details: { status: "failed", at: null, detail: "no" },
      },
      true,
    );
    expect(rows.map((r) => r.key)).toEqual(["seed", "pulse", "details", "semantic"]);
    expect(rows[0]).toMatchObject({ key: "seed", label: "1 Seed", status: "completed" });
    expect(rows[1]?.status).toBe("completed");
    expect(rows[2]?.status).toBe("failed");
    expect(rows[3]?.status).toBe("pending");
    expect(createFunctionRows({}, false)[0]?.status).toBe("pending");
  });
});

describe("enrichFunctionRows", () => {
  it("lists Enrich 1–10 and folds status from the map", () => {
    const rows = enrichFunctionRows({
      pulse: { status: "completed", at: null, detail: null },
      details: { status: "failed", at: null, detail: "no" },
      semantic: { status: "completed", at: null, detail: null },
    });
    expect(rows.map((r) => r.key)).toEqual([
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
    expect(rows[0]?.label).toBe("1 Pulse");
    expect(rows[0]?.status).toBe("completed");
    expect(rows[1]?.status).toBe("failed");
    expect(rows[2]?.status).toBe("pending");
    expect(rows[9]?.label).toBe(
      "10 Semantic (Mesita Name & Semantic Summary & Embeddings)",
    );
    expect(rows[9]?.status).toBe("completed");
  });
});

describe("Admin Status boxes", () => {
  it("AdminSection mounts Status · Create · Enrich as three cards", () => {
    const src = readFileSync(join(__dirname, "AdminSection.tsx"), "utf8");
    expect(src).toContain("CreateStatusCard");
    expect(src).toContain("EnrichStatusCard");
    expect(src).toContain("<StatusCard");
  });

  it("StatusCard no longer nests the Enrich function list", () => {
    const src = readFileSync(join(__dirname, "StatusCard.tsx"), "utf8");
    expect(src).not.toContain("enrichFunctionRows");
  });
});
