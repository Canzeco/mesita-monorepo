import { describe, expect, it } from "vitest";

import {
  DEFAULT_ASSUMPTIONS,
  SIMULATED_VISITS,
  distributionFor,
} from "./distribution-model";
import { DEFAULT_PROMOS } from "./promos";

describe("distributionFor", () => {
  it("conserves the full 1,000 visits across the distribution", () => {
    for (const strategy of ["conservative", "aggressive"] as const) {
      const r = distributionFor(DEFAULT_PROMOS, DEFAULT_ASSUMPTIONS, strategy);
      const total = r.dist.reduce((t, d) => t + d.visits, 0);
      expect(total).toBeCloseTo(SIMULATED_VISITS, 6);
    }
  });

  it("with zero action/welcome rates, everyone sits on their base — base-only segment", () => {
    const r = distributionFor(
      DEFAULT_PROMOS,
      {
        welcomePct: 0,
        classPct: { bronze: 100, silver: 0, gold: 0, diamond: 0 },
        premiumPct: 0,
        actionPct: { mesita: 0, story: 0, google: 0 },
      },
      "aggressive",
    );
    expect(r.dist).toEqual([
      {
        value: 20,
        visits: SIMULATED_VISITS,
        byBonusCount: [SIMULATED_VISITS, 0, 0],
      },
    ]);
    expect(r.mean).toBe(20);
    expect(r.q1).toBe(20);
    expect(r.median).toBe(20);
    expect(r.q3).toBe(20);
  });

  it("normalizes a class mix, and splits the plan axis independently", () => {
    const r = distributionFor(
      DEFAULT_PROMOS,
      {
        welcomePct: 0,
        classPct: { bronze: 1, silver: 0, gold: 0, diamond: 0 },
        premiumPct: 50,
        actionPct: { mesita: 0, story: 0, google: 0 },
      },
      "conservative",
    );
    expect(r.dist).toEqual([
      { value: 10, visits: 500, byBonusCount: [500, 0, 0] },
      { value: 20, visits: 500, byBonusCount: [500, 0, 0] },
    ]);
  });

  it("splits every point by bonus count and the segments sum to its visits", () => {
    const r = distributionFor(
      DEFAULT_PROMOS,
      DEFAULT_ASSUMPTIONS,
      "conservative",
    );
    for (const d of r.dist) {
      const [b0, b1, b2] = d.byBonusCount;
      expect(b0 + b1 + b2).toBeCloseTo(d.visits, 6);
      expect(Math.min(b0, b1, b2)).toBeGreaterThanOrEqual(0);
    }
  });

  it("a visit stacking welcome + one action lands in the 2+ segment", () => {
    // Everyone: first visit AND posts a story → every visit has exactly 2
    // bonuses (the automatic Welcome + the Story action).
    const r = distributionFor(
      DEFAULT_PROMOS,
      {
        welcomePct: 100,
        classPct: { bronze: 100, silver: 0, gold: 0, diamond: 0 },
        premiumPct: 0,
        actionPct: { mesita: 0, story: 100, google: 0 },
      },
      "conservative",
    );
    // standard base 10 + welcome 10 + story 10
    expect(r.dist).toEqual([
      {
        value: 30,
        visits: SIMULATED_VISITS,
        byBonusCount: [0, 0, SIMULATED_VISITS],
      },
    ]);
  });

  it("quartiles are ordered and inside [min, max]", () => {
    const r = distributionFor(
      DEFAULT_PROMOS,
      DEFAULT_ASSUMPTIONS,
      "aggressive",
    );
    expect(r.min).toBeLessThanOrEqual(r.q1);
    expect(r.q1).toBeLessThanOrEqual(r.median);
    expect(r.median).toBeLessThanOrEqual(r.q3);
    expect(r.q3).toBeLessThanOrEqual(r.max);
  });

  it("caps a stacked visit at 100%", () => {
    const rich = structuredClone(DEFAULT_PROMOS);
    rich.visits.base.aggressive.diamond.free = 70;
    rich.visits.bonuses.aggressive.welcome = 70;
    rich.visits.bonuses.aggressive.google = 70;
    const r = distributionFor(
      rich,
      {
        welcomePct: 100,
        classPct: { bronze: 0, silver: 0, gold: 0, diamond: 100 },
        premiumPct: 0,
        actionPct: { mesita: 0, story: 0, google: 100 },
      },
      "aggressive",
    );
    expect(r.dist).toEqual([
      {
        value: 100,
        visits: SIMULATED_VISITS,
        byBonusCount: [0, 0, SIMULATED_VISITS],
      },
    ]);
  });

  it("every class pays the same story bonus — the override retired with the influencer class", () => {
    const r = distributionFor(
      DEFAULT_PROMOS,
      {
        welcomePct: 0,
        classPct: { bronze: 0, silver: 100, gold: 0, diamond: 0 },
        premiumPct: 0,
        actionPct: { mesita: 0, story: 100, google: 0 },
      },
      "conservative",
    );
    // silver base 15 + the universal story bonus 10 — one bonus per visit
    expect(r.dist).toEqual([
      {
        value: 25,
        visits: SIMULATED_VISITS,
        byBonusCount: [0, SIMULATED_VISITS, 0],
      },
    ]);
  });

  it("the plan axis moves the whole distribution up without touching class", () => {
    const mix = {
      welcomePct: 0,
      classPct: { bronze: 100, silver: 0, gold: 0, diamond: 0 },
      actionPct: { mesita: 0, story: 0, google: 0 },
    };
    const allFree = distributionFor(
      DEFAULT_PROMOS,
      { ...mix, premiumPct: 0 },
      "aggressive",
    );
    const allPremium = distributionFor(
      DEFAULT_PROMOS,
      { ...mix, premiumPct: 100 },
      "aggressive",
    );
    expect(allFree.mean).toBe(20);
    expect(allPremium.mean).toBe(40);
  });
});
