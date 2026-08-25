import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { enrichFunctionRows } from "./status-enrichment";

describe("enrichFunctionRows", () => {
  it("lists the ten Enrich subfunctions and folds status from the map", () => {
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
    expect(rows[0]?.status).toBe("completed");
    expect(rows[1]?.status).toBe("failed");
    expect(rows[2]?.status).toBe("pending");
    expect(rows[9]?.label).toBe(
      "Semantic (Mesita Name & Semantic Summary & Embeddings)",
    );
    expect(rows[9]?.status).toBe("completed");
  });
});

describe("StatusCard source", () => {
  it("renders the Enrich function list under Enriched", () => {
    const src = readFileSync(join(__dirname, "StatusCard.tsx"), "utf8");
    expect(src).toContain("enrichFunctionRows");
    expect(src).toContain("enrich_functions");
  });
});
