import { describe, expect, it } from "vitest";
import {
  GENERAL_STATUS_COUNT,
  GENERAL_STATUS_FACTS,
  INTAKE_CREATE_COUNT,
  INTAKE_CREATE_FACTS,
  INTAKE_ENRICH_COUNT,
  INTAKE_ENRICH_FACTS,
} from "./status-vocabulary";

describe("status vocabulary counts", () => {
  it("is 7 general + 4 create + 10 enrich", () => {
    expect(GENERAL_STATUS_COUNT).toBe(7);
    expect(INTAKE_CREATE_COUNT).toBe(4);
    expect(INTAKE_ENRICH_COUNT).toBe(10);
    expect(GENERAL_STATUS_FACTS.map((f) => f.label)).toEqual([
      "Created",
      "Active",
      "Listed",
      "Enriched",
      "Verified",
      "Partner",
      "Promoting",
    ]);
    expect(INTAKE_CREATE_FACTS.map((f) => `${f.n} ${f.label}`)).toEqual([
      "0 Seed",
      "1 Pulse",
      "2 Details",
      "10 Semantics",
    ]);
    expect(INTAKE_ENRICH_FACTS.map((f) => `${f.n} ${f.label}`)).toEqual([
      "1 Pulse",
      "2 Details",
      "3 Serp",
      "4 Links",
      "5 Social",
      "6 Images",
      "7 Menu",
      "8 Reviews",
      "9 Description",
      "10 Semantics",
    ]);
  });
});
