import { describe, expect, it } from "vitest";

import {
  chipsFor,
  flowTag,
  flowTagFor,
  CRENUP_STEP_SPECS,
} from "./crenup-steps";

describe("crenup steps", () => {
  it("is nine, Seed through Embedding", () => {
    expect(CRENUP_STEP_SPECS.map((s) => s.key)).toEqual([
      "seed",
      "details",
      "serp",
      "links",
      "social",
      "reviews",
      "images",
      "description",
      "embedding",
    ]);
  });

  it("ONE ladder: the number is the step's, not the flow's", () => {
    // The whole point of MESITA-2027. `details` is 1 to BOTH callers; Create
    // simply runs a subset (0, 1, 7, 8). Before this, Create numbered itself
    // from 1 by position and called the same step 3.
    expect(chipsFor("create").map((c) => c.label)).toEqual([
      "0 Seed",
      "1 Details",
      "7 Description",
      "8 Embedding",
    ]);
    expect(chipsFor("enrich").map((c) => c.label)).toEqual([
      "1 Details",
      "2 Serp",
      "3 Links",
      "4 Social",
      "5 Reviews",
      "6 Images",
      "7 Description",
      "8 Embedding",
    ]);
  });

  it("Seed is Create-only; the gathers are Enrich-only", () => {
    expect(flowTag(["create"])).toBe("Create");
    expect(flowTag(["enrich"])).toBe("Enrich");
    expect(flowTag(["create", "enrich"])).toBe("Create + Enrich");
    expect(CRENUP_STEP_SPECS.find((s) => s.key === "seed")?.flows).toEqual([
      "create",
    ]);
    expect(CRENUP_STEP_SPECS.find((s) => s.key === "serp")?.flows).toEqual([
      "enrich",
    ]);
    expect(flowTagFor("seed")).toBe("Create");
    expect(flowTagFor("details")).toBe("Create + Enrich");
    expect(flowTagFor("reviews")).toBe("Enrich");
    expect(flowTagFor("description")).toBe("Create + Enrich");
    expect(flowTagFor("embedding")).toBe("Create + Enrich");
  });
});
