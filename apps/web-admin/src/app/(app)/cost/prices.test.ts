import { describe, expect, it } from "vitest";
import { COST_JOBS, apifyMapsUsd, first300Viewers, jobTotal, jobsIn } from "./prices";

describe("published place costs", () => {
  it("pins the four jobs and puts only Create in Fixed", () => {
    expect(jobsIn("fixed").map((j) => j.id)).toEqual(["create"]);
    expect(jobsIn("variable").map((j) => j.id)).toEqual([
      "fast-update",
      "deep-update",
      "enrich",
    ]);
    expect(jobTotal(COST_JOBS.find((j) => j.id === "create")!)).toBe(0.039);
    expect(jobTotal(COST_JOBS.find((j) => j.id === "fast-update")!)).toBe(0.03);
    expect(jobTotal(COST_JOBS.find((j) => j.id === "deep-update")!)).toBe(0.091);
    expect(jobTotal(COST_JOBS.find((j) => j.id === "enrich")!)).toBe(0.303);
  });

  it("names Deep Enrich on the Enrich job, not as its own bill", () => {
    const enrich = COST_JOBS.find((j) => j.id === "enrich")!;
    expect(enrich.alsoCalled).toBe("Deep Enrich");
    expect(COST_JOBS.filter((j) => j.alsoCalled === "Deep Enrich")).toHaveLength(1);
  });

  it("prices a 100-review Maps run at the per-event rate, not $0.30", () => {
    expect(apifyMapsUsd(0)).toBe(0);
    expect(apifyMapsUsd(100)).toBeCloseTo(0.056, 6);
    expect(apifyMapsUsd(100)).toBeLessThan(0.3);
  });

  it("prices the first 300 viewers without adding Create again", () => {
    expect(first300Viewers()).toEqual({ fast: 0.87, deepUpdate: 0.546, enrich: 0.303 });
  });
});
