import { describe, expect, it } from "vitest";
import {
  GENERAL_STATUS_COUNT,
  GENERAL_STATUS_FACTS,
  INTAKE_FUNCTION_COUNT,
  INTAKE_FUNCTIONS,
  intakeFunctionLabel,
} from "./status-vocabulary";

describe("status vocabulary", () => {
  it("is seven general bools plus eleven Intake functions 0–10", () => {
    expect(GENERAL_STATUS_COUNT).toBe(7);
    expect(INTAKE_FUNCTION_COUNT).toBe(11);
    expect(GENERAL_STATUS_FACTS.map((f) => f.label)).toEqual([
      "Created",
      "Active",
      "Listed",
      "Enriched",
      "Verified",
      "Partner",
      "Promoting",
    ]);
    expect(INTAKE_FUNCTIONS.map((f) => `${f.n}. ${f.label}`)).toEqual([
      "0. Seed",
      "1. Pulse",
      "2. Details",
      "3. Serp",
      "4. Links",
      "5. Social",
      "6. Images",
      "7. Menu",
      "8. Reviews",
      "9. Description",
      "10. Semantic",
    ]);
    expect(INTAKE_FUNCTIONS.map((f) => intakeFunctionLabel(f.n, f.label))).toEqual(
      INTAKE_FUNCTIONS.map((f) => `${f.n}. ${f.label}`),
    );
  });
});
