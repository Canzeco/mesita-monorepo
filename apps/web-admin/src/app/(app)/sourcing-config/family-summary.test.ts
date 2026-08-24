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
