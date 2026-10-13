import { describe, expect, it } from "vitest";
import {
  BAD_WHEN_TRUE,
  GENERAL_STATE_FACTS,
  CRENUP_STEPS,
  creationFlowMark,
  crenupFlowTag,
  crenupStepLabel,
  enrichmentStepLabel,
  stepEnriches,
  STATE_FACT_FALSE_TONE,
  requestCountChip,
  requestCountFromRow,
  stateBoolChip,
} from "./state-vocabulary";

describe("state vocabulary", () => {
  it("is six general facts plus nine Crenup steps 0–8", () => {
    // The MVP First Stage cut the commercial facts: Verified (MESITA-2106),
    // then Owned · Partnered · Rewards · Mesita Pay · Mesita Credits
    // (MESITA-2115).
    expect(GENERAL_STATE_FACTS.map((f) => f.label)).toEqual([
      "Created",
      "Pulsing",
      "Requested",
      "Enriching",
      "Enriched",
      "Disabled",
    ]);
    expect([...BAD_WHEN_TRUE]).toEqual(["disabled"]);
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
    expect(
      CRENUP_STEPS.filter((f) => stepEnriches(f.flows)).map((f) =>
        enrichmentStepLabel(f.n, f.label),
      ),
    ).toEqual([
      "1. Details Enriched",
      "2. Serp Enriched",
      "3. Links Enriched",
      "4. Social Enriched",
      "5. Reviews Enriched",
      "6. Images Enriched",
      "7. Description Enriched",
      "8. Embedding Enriched",
    ]);
    expect(
      CRENUP_STEPS.filter((f) => creationFlowMark(f.flows) !== null).map((f) => f.label),
    ).toEqual(["Seed", "Details", "Description", "Embedding"]);
    expect(crenupFlowTag(["create"])).toBe("Create");
    expect(crenupFlowTag(["create", "enrich"])).toBe("Create + Enrich");
    expect(crenupFlowTag(["enrich"])).toBe("Enrich");
    expect(creationFlowMark(["create"])).toBe("Create");
    expect(creationFlowMark(["create", "enrich"])).toBe("Create + Enrich");
    expect(creationFlowMark(["enrich"])).toBeNull();
  });

  it("every general-state false reads rose — no neutral-grey exception (MESITA-1684, decision: Pato)", () => {
    expect(Object.keys(STATE_FACT_FALSE_TONE)).toEqual([]);
  });

  it("binary chips are true / false, not the fact name", () => {
    expect(stateBoolChip(true)).toBe("true");
    expect(stateBoolChip(false)).toBe("false");
    expect(stateBoolChip("unknown")).toBe("?");
    expect(stateBoolChip("loading")).toBe("…");
    expect(stateBoolChip(null)).toBe("?");
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
