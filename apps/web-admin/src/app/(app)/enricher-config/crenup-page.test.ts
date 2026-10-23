import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("crenup-page", () => {
  it("does not embed analytics on Creation config", () => {
    const src = readFileSync(join(__dirname, "crenup-page.tsx"), "utf8");
    expect(src.includes("PlaceOpensCard")).toBe(false);
    expect(src.includes("listPlaceOpens")).toBe(false);
  });
});
