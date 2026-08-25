import { describe, expect, it } from "vitest";

import { PIPELINE_STEPS } from "./pipeline";

describe("PIPELINE_STEPS", () => {
  it("is Search, then Create, then Enrich — the page must show all three", () => {
    expect(PIPELINE_STEPS.map((s) => s.label)).toEqual([
      "Search",
      "Create",
      "Enrich",
    ]);
    expect(PIPELINE_STEPS.map((s) => s.n)).toEqual([1, 2, 3]);
    expect(new Set(PIPELINE_STEPS.map((s) => s.id)).size).toBe(3);
  });
});
