import { describe, expect, it } from "vitest";

import {
  DEFAULT_ASSUMPTIONS,
  SIMULATED_VISITS,
  distributionFor,
} from "./distribution";
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
        classPct: { standard: 100, influencer: 0, premium: 0, aura: 0 },
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

  it("normalizes a class mix that does not sum to 100", () => {
    const r = distributionFor(
      DEFAULT_PROMOS,
      {
        welcomePct: 0,
        classPct: { standard: 1, influencer: 0, premium: 1, aura: 0 },
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
        classPct: { standard: 100, influencer: 0, premium: 0, aura: 0 },
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
    const rich = {
      ...DEFAULT_PROMOS,
      base: {
        ...DEFAULT_PROMOS.base,
        aggressive: { ...DEFAULT_PROMOS.base.aggressive, aura: 70 },
      },
      bonuses: { ...DEFAULT_PROMOS.bonuses, welcome: 70, google: 70 },
    };
    const r = distributionFor(
      rich,
      {
        welcomePct: 100,
        classPct: { standard: 0, influencer: 0, premium: 0, aura: 100 },
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

  it("influencer stories use the override in the simulated totals", () => {
    const r = distributionFor(
      DEFAULT_PROMOS,
      {
        welcomePct: 0,
        classPct: { standard: 0, influencer: 100, premium: 0, aura: 0 },
        actionPct: { mesita: 0, story: 100, google: 0 },
      },
      "conservative",
    );
    // influencer base 15 + override 30 — one bonus per visit
    expect(r.dist).toEqual([
      {
        value: 45,
        visits: SIMULATED_VISITS,
        byBonusCount: [0, SIMULATED_VISITS, 0],
      },
    ]);
  });
});
