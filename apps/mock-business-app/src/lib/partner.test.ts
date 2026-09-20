// ONE READER OF THE BADGE, AND WHICH WAY THE IMPLICATION RUNS (MESITA-2017).
import { describe, expect, it } from "vitest";
import { PLACES, PROFILES } from "@/mock/fixtures";
import { partnerChecks, partnerStatus, profileComplete } from "./partner";
import type { MockPlace } from "@/mock/types";

const lumbre = PLACES.find((p) => p.id === "plc_lumbre")!;
const norte = PLACES.find((p) => p.id === "plc_norte")!;

describe("the checklist", () => {
  it("has five rows, and only Verified and the plan remove a held badge", () => {
    const checks = partnerChecks(lumbre, PROFILES[lumbre.id]);
    expect(checks.map((c) => c.key)).toEqual(["verified", "profile", "rewards", "payments", "plan"]);
    expect(checks.filter((c) => c.removes).map((c) => c.key)).toEqual(["verified", "plan"]);
  });

  it("a badge is never held without a paid rung, in every fixture", () => {
    for (const p of PLACES) {
      const s = partnerStatus(p, PROFILES[p.id]);
      if (s.badge) expect(p.partnered).toBe(true);
    }
  });

  it("a paid rung alone does not hold it", () => {
    const paidButBare: MockPlace = { ...norte, plan: "pro", partnered: true, verified: true, partnerHeld: false };
    const s = partnerStatus(paidButBare, PROFILES[norte.id]);
    expect(s.badge).toBe(false);
    expect(s.atRisk).toBe(false);
    expect(s.failing.map((c) => c.key)).toContain("payments");
  });

  it("a held badge survives Rewards pausing, as at-risk, and dies on a lapse", () => {
    const held = partnerStatus(lumbre, PROFILES[lumbre.id]);
    expect(held).toMatchObject({ badge: true, atRisk: false, done: 5 });

    const paused = partnerStatus({ ...lumbre, visitRewards: false }, PROFILES[lumbre.id]);
    expect(paused).toMatchObject({ badge: true, atRisk: true, done: 4 });

    const lapsed = partnerStatus({ ...lumbre, plan: "free", partnered: false }, PROFILES[lumbre.id]);
    expect(lapsed.badge).toBe(false);
    expect(lapsed.atRisk).toBe(false);
  });

  it("profile completeness needs a name, an address, hours and a photo", () => {
    expect(profileComplete(PROFILES[lumbre.id])).toBe(true);
    expect(profileComplete({ ...PROFILES[lumbre.id], photos: [] })).toBe(false);
    expect(profileComplete(undefined)).toBe(false);
  });
});
