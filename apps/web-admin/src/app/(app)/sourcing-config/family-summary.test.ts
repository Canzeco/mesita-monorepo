import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { FamilyKey } from "./catalog";
import { familySummary } from "./family-summary";

const all: FamilyKey[] = [
  "restaurants",
  "bars_nightlife",
  "cafes_bakeries",
  "wellness_spa",
  "experiences",
  "culture_arts",
];

describe("familySummary", () => {
  it("reads a full set as all", () => {
    expect(familySummary(all)).toEqual({ kind: "all", label: "all" });
  });

  it("reads an empty set as none", () => {
    expect(familySummary([])).toEqual({ kind: "none", label: "none" });
  });

  it("counts a partial set", () => {
    expect(familySummary(["restaurants", "bars_nightlife"])).toEqual({
      kind: "some",
      label: "2 of 6",
    });
  });
});

describe("Sourcing family chips", () => {
  it("lays six families in a 3-column grid so they read on two lines", () => {
    const src = readFileSync(join(__dirname, "SourcingConfigClient.tsx"), "utf8");
    expect(src).toContain("grid grid-cols-3");
    expect(src).toContain("text-sm leading-snug");
  });
});
