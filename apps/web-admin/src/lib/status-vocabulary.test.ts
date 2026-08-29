import { describe, expect, it } from "vitest";
import {
  GENERAL_STATUS_COUNT,
  GENERAL_STATUS_FACTS,
  INTAKE_FUNCTION_COUNT,
  INTAKE_FUNCTIONS,
  intakeFunctionLabel,
  operatorPromotingLevel,
  promotingLevelChip,
  promotingLevelFromStrategy,
  requestCountChip,
  requestCountFromRow,
  statusBoolChip,
} from "./status-vocabulary";

describe("status vocabulary", () => {
  it("is nine general facts plus eleven Intake functions 0–10", () => {
    expect(GENERAL_STATUS_COUNT).toBe(9);
    expect(INTAKE_FUNCTION_COUNT).toBe(11);
    expect(GENERAL_STATUS_FACTS.map((f) => f.label)).toEqual([
      "Created",
      "Active",
      "Listed",
      "Requested",
      "Enriched",
      "Enriching",
      "Verified",
      "Partnered",
      "Promoted",
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

  it("binary chips are true / false, not the fact name", () => {
    expect(statusBoolChip(true)).toBe("true");
    expect(statusBoolChip(false)).toBe("false");
    expect(statusBoolChip("unknown")).toBe("?");
    expect(statusBoolChip("loading")).toBe("…");
    expect(statusBoolChip(null)).toBe("?");
  });

  it("Promoted is 0 | 1 | 2 — engine Dominant displays as 2", () => {
    expect(operatorPromotingLevel(0)).toBe(0);
    expect(operatorPromotingLevel(1)).toBe(1);
    expect(operatorPromotingLevel(2)).toBe(2);
    expect(operatorPromotingLevel(3)).toBe(2);
    expect(operatorPromotingLevel(-1)).toBe(0);
    expect(operatorPromotingLevel(undefined)).toBe(0);
    expect(promotingLevelChip(3)).toBe("2");
    expect(promotingLevelFromStrategy(false, "aggressive")).toBe(0);
    expect(promotingLevelFromStrategy(true, "conservative")).toBe(1);
    expect(promotingLevelFromStrategy(true, "aggressive")).toBe(2);
    expect(promotingLevelFromStrategy(true, "dominant")).toBe(2);
    expect(promotingLevelFromStrategy(true, null)).toBe(2);
  });

  it("Requested is 0…n, never a Yes/No", () => {
    expect(requestCountFromRow(0)).toBe(0);
    expect(requestCountFromRow(1)).toBe(1);
    expect(requestCountFromRow(12.9)).toBe(12);
    expect(requestCountFromRow("7")).toBe(7);
    expect(requestCountFromRow(null)).toBe("unknown");
    expect(requestCountFromRow(undefined)).toBe("unknown");
    expect(requestCountFromRow(-1)).toBe("unknown");
    expect(requestCountChip(0)).toBe("0");
    expect(requestCountChip(4)).toBe("4");
    expect(requestCountChip(undefined)).toBe("?");
  });
});
