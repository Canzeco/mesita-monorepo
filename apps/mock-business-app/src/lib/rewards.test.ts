// WHAT THIS CONSOLE OWNS, WHICH IS NO LONGER THE MATH (MESITA-2038).
//
// The rates, the base and the ceiling moved to `shared/rewards-model.ts` and
// are tested there, in Deno, once, for all six packages that read them. Testing
// them again here would assert a generated copy against itself.
//
// What is left for this file is the SEAM: the shape a place saves, how that
// shape becomes the lever map the engine wants, and which levers a plan
// carries. Every assertion is a bijection where one exists — "welcome is on"
// passes for a function that returns true, "welcome is on when the place set it
// and absent when it did not" does not.
import { describe, expect, it } from "vitest";
import {
  BONUS_KEYS,
  DEFAULT_PROGRAM,
  LEVER_HINT,
  LEVER_LABEL,
  MODE_HINT,
  MODE_LABEL,
  MODE_NEEDS_CREDITS,
  planCarries,
  toLeverState,
  type RewardsProgram,
} from "./rewards";
import {
  activeLevers,
  ceilingPct,
  LEVER_PCT,
  planMaxCentavos,
  rewardCentavos,
} from "./rewards-model";

const ON: RewardsProgram = { on: true, mode: "discount", welcome: true, story: true };
const OFF: RewardsProgram = { ...ON, on: false };

describe("the shape a place saves", () => {
  it("carries exactly the three things an operator decides", () => {
    expect(Object.keys(DEFAULT_PROGRAM).sort()).toEqual([
      "mode",
      "on",
      "story",
      "welcome",
    ]);
  });

  it("has no cap: the rewardable base is fixed for every place", () => {
    expect("cap" in DEFAULT_PROGRAM).toBe(false);
  });

  it("has no mesita review lever: Pato's table is four levers and this is not one", () => {
    expect("mesita" in DEFAULT_PROGRAM).toBe(false);
  });

  it("offers exactly two switchable bonuses — base and Diamond are not toggles", () => {
    expect([...BONUS_KEYS]).toEqual(["welcome", "story"]);
  });
});

describe("the program becomes the lever map the engine wants", () => {
  it("base follows the program switch, not a bonus row", () => {
    expect(toLeverState(ON).base).toBe(true);
    expect(toLeverState(OFF).base).toBe(false);
  });

  it("diamond is always true — Mesita's list, not the place's switch", () => {
    expect(toLeverState(ON).diamond).toBe(true);
    expect(toLeverState({ ...ON, welcome: false, story: false }).diamond).toBe(true);
  });

  it("welcome and story carry what the place actually set, both ways", () => {
    expect(toLeverState({ ...ON, welcome: true }).welcome).toBe(true);
    expect(toLeverState({ ...ON, welcome: false }).welcome).toBe(false);
    expect(toLeverState({ ...ON, story: true }).story).toBe(true);
    expect(toLeverState({ ...ON, story: false }).story).toBe(false);
  });

  it("the program off means nothing pays, whatever the bonuses say", () => {
    expect(activeLevers("ultra", toLeverState(OFF), {
      welcome: true,
      story: true,
      diamond: true,
    })).toEqual([]);
    expect(rewardCentavos("ultra", toLeverState(OFF), { welcome: true }, 100_000)).toBe(0);
  });
});

describe("what a plan carries", () => {
  it("Story is Ultra's alone", () => {
    expect(planCarries("ultra", "story")).toBe(true);
    expect(planCarries("pro", "story")).toBe(false);
    expect(planCarries("free", "story")).toBe(false);
  });

  it("Pro carries the other three", () => {
    expect(planCarries("pro", "base")).toBe(true);
    expect(planCarries("pro", "welcome")).toBe(true);
    expect(planCarries("pro", "diamond")).toBe(true);
  });

  it("Free carries nothing", () => {
    expect(planCarries("free", "base")).toBe(false);
    expect(planCarries("free", "welcome")).toBe(false);
    expect(planCarries("free", "diamond")).toBe(false);
  });

  it("a Pro place that saved story:true still cannot pay it", () => {
    // The saved value is PRESERVED — the row renders locked, not off, so an
    // upgrade turns it back on without the operator re-deciding. But the plan
    // is what decides whether it pays, and it does not.
    const proLevers = toLeverState({ ...ON, story: true });
    expect(proLevers.story).toBe(true);
    expect(activeLevers("pro", proLevers, { story: true }).includes("story")).toBe(false);
    expect(ceilingPct("pro", proLevers)).toBe(40);
    expect(ceilingPct("ultra", proLevers)).toBe(60);
  });
});

describe("the ceiling this console prints is the plan's", () => {
  it("Pro tops out at MX$80 and Ultra at MX$120", () => {
    expect(planMaxCentavos("pro")).toBe(8_000);
    expect(planMaxCentavos("ultra")).toBe(12_000);
    // The two differ — which is what makes printing one number a bug.
    expect(planMaxCentavos("pro")).not.toBe(planMaxCentavos("ultra"));
  });

  it("a big bill does not raise it", () => {
    expect(rewardCentavos("pro", toLeverState(ON), {
      welcome: true,
      story: true,
      diamond: true,
    }, 1_000_000)).toBe(8_000);
  });
});

describe("the copy names the right thing", () => {
  it("base wears the program's name, because base off is the program off", () => {
    expect(LEVER_LABEL.base).toBe("Rewards");
  });

  it("diamond's hint says Mesita owns it, so the row reads as disclosure", () => {
    expect(LEVER_HINT.diamond).toMatch(/Mesita/);
    expect(LEVER_HINT.diamond).toMatch(/you do not switch it/);
  });

  it("story's hint does not promise a follower threshold that is not enforced", () => {
    expect(LEVER_HINT.story).not.toMatch(/1,?000/);
    expect(LEVER_HINT.story).not.toMatch(/follower/i);
  });

  it("every lever the model prices has a label and a hint here", () => {
    for (const key of Object.keys(LEVER_PCT) as (keyof typeof LEVER_PCT)[]) {
      expect(LEVER_LABEL[key]).toBeTruthy();
      expect(LEVER_HINT[key]).toBeTruthy();
    }
  });

  it("all three modes are named, and named differently", () => {
    const labels = [MODE_LABEL.discount, MODE_LABEL.cashback, MODE_LABEL.both];
    expect(labels.every(Boolean)).toBe(true);
    expect(new Set(labels).size).toBe(3);
  });
});

describe("what each mode needs behind it", () => {
  it("discount needs nothing — it works with cash and the place's own terminal", () => {
    expect(MODE_NEEDS_CREDITS.discount).toBe(false);
  });

  it("cashback and both need Credits, because both settle after the bill", () => {
    expect(MODE_NEEDS_CREDITS.cashback).toBe(true);
    expect(MODE_NEEDS_CREDITS.both).toBe(true);
  });

  it("every mode has a hint, and every mode is classified", () => {
    for (const mode of ["discount", "cashback", "both"] as const) {
      expect(MODE_HINT[mode]).toBeTruthy();
      expect(typeof MODE_NEEDS_CREDITS[mode]).toBe("boolean");
    }
  });

  it("the both hint says discount is preselected, so the nudge is stated not hidden", () => {
    expect(MODE_HINT.both).toMatch(/Discount is preselected/);
  });
});
