import { describe, expect, it } from "vitest";

import {
  chipsFor,
  flowTag,
  flowTagFor,
  INTAKE_SUBFUNCTIONS,
} from "./intake-functions";

describe("intake subfunctions", () => {
  it("is twelve, Seed through Summary, Name before Summary", () => {
    expect(INTAKE_SUBFUNCTIONS.map((s) => s.key)).toEqual([
      "seed",
      "pulse",
      "details",
      "serp",
      "links",
      "social",
      "images",
      "menu",
      "reviews",
      "description",
      "name",
      "summary",
    ]);
  });

  it("Create is one run of five; Enrich is sequential over eleven", () => {
    expect(chipsFor("create").map((c) => c.label)).toEqual([
      "Seed",
      "1 Pulse",
      "2 Details",
      "◇ Name",
      "◇ Summary",
    ]);
    expect(chipsFor("enrich").map((c) => c.label)).toEqual([
      "1 Pulse",
      "2 Details",
      "3 Serp",
      "4 Links",
      "5 Social",
      "6 Images",
      "7 Menu",
      "8 Reviews",
      "9 Description",
      "◇ Name",
      "◇ Summary",
    ]);
  });

  it("Seed is Create-only; numbered 3–9 are Enrich-only", () => {
    expect(flowTag(["create"])).toBe("Create");
    expect(flowTag(["enrich"])).toBe("Enrich");
    expect(flowTag(["create", "enrich"])).toBe("Create + Enrich");
    expect(INTAKE_SUBFUNCTIONS.find((s) => s.key === "seed")?.flows).toEqual([
      "create",
    ]);
    expect(INTAKE_SUBFUNCTIONS.find((s) => s.key === "serp")?.flows).toEqual([
      "enrich",
    ]);
    expect(flowTagFor("seed")).toBe("Create");
    expect(flowTagFor("pulse")).toBe("Create + Enrich");
    expect(flowTagFor("menu")).toBe("Enrich");
    expect(flowTagFor("name")).toBe("Create + Enrich");
  });
});
