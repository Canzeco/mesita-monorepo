import { describe, expect, it } from "vitest";

import { coerceResults } from "./catalog";

describe("coerceResults", () => {
  it("falls back to down and the id for an unknown verdict and provider", () => {
    const [row] = coerceResults([{ id: "zzz", verdict: "???" }]);
    expect(row).toMatchObject({ verdict: "down", label: "zzz" });
  });

  it("returns an empty list for a non-array payload", () => {
    expect(coerceResults("x")).toEqual([]);
  });
});
