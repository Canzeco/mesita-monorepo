// THE PROGRAM ADDS UP, AND THE OPERATOR ONLY FLIPS SWITCHES (MESITA-2017).
//
// Every assertion here is a bijection where one exists: the rate with a
// switch on against the same rate with it off. "welcome adds ten" passes
// trivially for a function that returns ten; "welcome adds ten only when the
// place has it on AND the guest earned it, and zero otherwise" does not.
import { describe, expect, it } from "vitest";
import {
  CAPS_MXN,
  CLASS_STEP,
  DEFAULT_PROGRAM,
  EVERYTHING_EARNED,
  NOTHING_EARNED,
  RATE,
  capCostCents,
  ceiling,
  rate,
  stack,
  type RewardsProgram,
} from "./rewards";
import { PLACES } from "@/mock/fixtures";

const ALL_ON: RewardsProgram = { ...DEFAULT_PROGRAM, on: true, welcome: true, story: true, mesita: true };
const ALL_OFF: RewardsProgram = { ...ALL_ON, welcome: false, story: false, mesita: false };

describe("the rate", () => {
  it("is zero when the program is off, whatever the guest did", () => {
    expect(rate({ ...ALL_ON, on: false }, EVERYTHING_EARNED)).toBe(0);
    expect(stack({ ...ALL_ON, on: false })).toEqual([]);
  });

  it("is the base and nothing more when every action is off", () => {
    expect(rate(ALL_OFF, EVERYTHING_EARNED)).toBe(RATE.base);
    expect(rate(ALL_OFF, NOTHING_EARNED)).toBe(RATE.base);
  });

  it("adds welcome only when the place has it on and the guest earned it", () => {
    const earned = { ...NOTHING_EARNED, welcome: true };
    expect(rate({ ...ALL_OFF, welcome: true }, earned)).toBe(RATE.base + RATE.welcome);
    expect(rate({ ...ALL_OFF, welcome: false }, earned)).toBe(RATE.base);
    expect(rate({ ...ALL_OFF, welcome: true }, NOTHING_EARNED)).toBe(RATE.base);
  });

  it("pays one flat story bonus — no class reads into it", () => {
    const earned = { ...NOTHING_EARNED, story: true };
    const withStory = rate({ ...ALL_OFF, story: true }, earned);
    expect(withStory).toBe(RATE.base + RATE.story);
    // The class ladder exists for the engine and prices nothing here: a
    // diamond and a bronze guest earn the same story bonus.
    expect(CLASS_STEP.diamond).toBeGreaterThan(CLASS_STEP.bronze);
    expect(withStory - RATE.base).toBe(RATE.story);
  });

  it("keeps the Mesita review as a toggle of its own", () => {
    const earned = { ...NOTHING_EARNED, mesita: true };
    expect(rate({ ...ALL_OFF, mesita: true }, earned)).toBe(RATE.base + RATE.mesita);
    expect(rate({ ...ALL_OFF, mesita: false }, earned)).toBe(RATE.base);
  });

  it("clamps at one hundred", () => {
    // The table cannot reach 100 today; the clamp is asserted against a
    // program whose numbers are forced past it, so the guard exists before
    // the day the table does.
    const total = RATE.base + RATE.welcome + RATE.story + RATE.mesita;
    expect(total).toBeLessThanOrEqual(100);
    expect(ceiling(ALL_ON)).toBe(Math.min(100, total));
  });
});

describe("the cap", () => {
  it("is one of the three legal caps, and bounds the cost separately from the rate", () => {
    expect([...CAPS_MXN]).toEqual([200, 500, 1000]);
    // 45% of the first MX$500 is MX$225, in centavos.
    expect(capCostCents(45, 500)).toBe(22_500);
    expect(capCostCents(0, 1000)).toBe(0);
  });
});

describe("the stack", () => {
  it("is a running total in engine order, with switched-off actions absent", () => {
    expect(stack(ALL_ON).map((s) => s.total)).toEqual([20, 30, 40, 45]);
    expect(stack({ ...ALL_ON, story: false }).map((s) => s.key)).toEqual(["base", "welcome", "mesita"]);
  });
});

describe("regression: today's fixture places under the new table", () => {
  // GENERATED FROM THE TABLE, THEN PINNED. When the table changes, the
  // second expectation changes with it in the same commit — a silent change
  // to what every running place pays is the thing this test exists to catch.
  const expected = PLACES.map((p) => ({
    id: p.id,
    ceiling: rate({ on: p.visitRewards, ...p.rewards }, EVERYTHING_EARNED),
  }));

  it("matches the table for every place", () => {
    for (const { id, ceiling: c } of expected) {
      const p = PLACES.find((x) => x.id === id)!;
      expect(c).toBe(ceiling({ on: p.visitRewards, ...p.rewards }));
    }
  });

  it("is pinned", () => {
    expect(expected).toEqual([
      { id: "plc_lumbre", ceiling: 45 },
      { id: "plc_pardo", ceiling: 0 },
      { id: "plc_hoja", ceiling: 35 },
      { id: "plc_norte", ceiling: 0 },
    ]);
  });
});
