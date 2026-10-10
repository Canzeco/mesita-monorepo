import { describe, expect, it } from "vitest";
import {
  ENGINELESS_STATE_FACT_KEYS,
  GENERAL_STATE_COUNT,
  GENERAL_STATE_FACTS,
  CRENUP_STEP_COUNT,
  CRENUP_STEPS,
  crenupStepLabel,
  STATE_FACT_FALSE_TONE,
  operatorPromotingLevel,
  promotingLevelChip,
  promotingLevelFromStrategy,
  requestCountChip,
  requestCountFromRow,
  stateBoolChip,
} from "./state-vocabulary";

describe("state vocabulary", () => {
  it("is eleven general facts plus nine Crenup steps 0–8", () => {
    // Owned joined with MESITA-1608 — somebody holds this place (the claim
    // on `places` since MESITA-1892; an organization before that), which
    // is not the same claim as Verified (having PROVED you hold it).
    expect(GENERAL_STATE_COUNT).toBe(11);
    expect(CRENUP_STEP_COUNT).toBe(9);
    expect(GENERAL_STATE_FACTS.map((f) => f.label)).toEqual([
      "Created",
      "Active",
      "Listed",
      "Requested",
      "Enriching",
      "Enriched",
      "Owned",
      "Partnered",
      "Rewards",
      "Mesita Pay",
      "Mesita Credits",
    ]);
    expect(CRENUP_STEPS.map((f) => `${f.n}. ${f.label}`)).toEqual([
      "0. Seed",
      "1. Details",
      "2. Serp",
      "3. Links",
      "4. Social",
      "5. Reviews",
      "6. Images",
      "7. Description",
      "8. Embedding",
    ]);
    expect(CRENUP_STEPS.map((f) => crenupStepLabel(f.n, f.label))).toEqual(
      CRENUP_STEPS.map((f) => `${f.n}. ${f.label}`),
    );
  });

  it("every general-state false reads rose — no neutral-grey exception (MESITA-1684, decision: Pato)", () => {
    expect(STATE_FACT_FALSE_TONE.partner).toBeUndefined();
    expect(STATE_FACT_FALSE_TONE.mesita_pay).toBeUndefined();
    expect(STATE_FACT_FALSE_TONE.credits).toBeUndefined();
    expect(STATE_FACT_FALSE_TONE.owned).toBeUndefined();
    expect(Object.keys(STATE_FACT_FALSE_TONE)).toEqual([]);
    // Acceptance bits are still engineless (no chips/segments) until their
    // engines land — that gate is unrelated to the false-tone color.
    expect([...ENGINELESS_STATE_FACT_KEYS]).toEqual(["mesita_pay", "credits"]);
  });

  it("binary chips are true / false, not the fact name", () => {
    expect(stateBoolChip(true)).toBe("true");
    expect(stateBoolChip(false)).toBe("false");
    expect(stateBoolChip("unknown")).toBe("?");
    expect(stateBoolChip("loading")).toBe("…");
    expect(stateBoolChip(null)).toBe("?");
  });

  it("Rewards is 0 | 1 | 2 — engine Dominant displays as 2", () => {
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
