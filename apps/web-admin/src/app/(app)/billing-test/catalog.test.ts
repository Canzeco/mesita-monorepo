import { describe, expect, it } from "vitest";

import { coerceResults, KNOWN_PROBES } from "./catalog";

describe("coerceResults", () => {
  it("falls back to down and the id for an unknown verdict and provider", () => {
    const [row] = coerceResults([{ id: "zzz", verdict: "???" }]);
    expect(row).toMatchObject({ verdict: "down", label: "zzz" });
  });

  it("returns an empty list for a non-array payload", () => {
    expect(coerceResults("x")).toEqual([]);
  });
});

describe("KNOWN_PROBES copy", () => {
  it("does not mention Ojo or Business plans (First Stage)", () => {
    const blob = JSON.stringify(KNOWN_PROBES);
    expect(blob).not.toContain("Ojo");
    expect(blob).not.toContain("Business plans");
  });
});
