import { describe, expect, it } from "vitest";
import {
  CLASS_KEYS,
  DEFAULT_PROMOS,
  METER_SEGMENTS,
  PLAN_KEYS,
  coercePromosConfig,
  giveLevel,
  premiumUplift,
  totalFor,
  visibilityDots,
  type PromosConfig,
} from "./promos";

// DRIFT ALARM. These are the admin console's numbers, asserted here so the two
// consoles cannot quietly disagree about what a strategy costs. If a change to
// apps/web-admin's promos.ts / distribution-model.ts doesn't land in
// promos.ts, this file goes red — which is the entire point of it existing
// (MESITA-1001).
describe("promos — lockstep with the admin twin", () => {
  it("reproduces the admin expected-rate numbers exactly", () => {
    const cons = giveLevel(DEFAULT_PROMOS, "conservative");
    const aggr = giveLevel(DEFAULT_PROMOS, "aggressive");
    expect(cons.mean).toBe(20);
    expect(aggr.mean).toBe(34);
    expect([cons.p10, cons.p90]).toEqual([10, 30]);
    expect([aggr.p10, aggr.p90]).toEqual([20, 50]);
  });

  it("prices returning visits the way the engine does, not the presets", () => {
    // The bug this file exists to kill: strategies.ts says a returning Bronze
    // guest on Aggressive gets free_rate = 10%. The engine pays base = 20%.
    expect(
      totalFor(DEFAULT_PROMOS, "aggressive", "bronze", "standing"),
    ).toBe(20);
    // The paid PLAN at the same class — what the old `premium` CLASS row was.
    expect(
      totalFor(DEFAULT_PROMOS, "aggressive", "bronze", "standing", "premium"),
    ).toBe(40);
    // Welcome rows are where the legacy presets happened to agree.
    expect(totalFor(DEFAULT_PROMOS, "aggressive", "bronze", "welcome")).toBe(30);
    expect(
      totalFor(DEFAULT_PROMOS, "aggressive", "bronze", "welcome", "premium"),
    ).toBe(50);
  });

  it("defaults to the Free plan — the console never prints a guest's plan", () => {
    for (const cls of CLASS_KEYS) {
      expect(totalFor(DEFAULT_PROMOS, "conservative", cls, "standing")).toBe(
        DEFAULT_PROMOS.visits.base.conservative[cls].free,
      );
    }
  });

  it("states the Premium uplift as one number per class", () => {
    // +10 conservative / +20 aggressive across the whole ladder.
    for (const cls of CLASS_KEYS) {
      expect(premiumUplift(DEFAULT_PROMOS, "conservative", cls)).toBe(10);
      expect(premiumUplift(DEFAULT_PROMOS, "aggressive", cls)).toBe(20);
    }
  });

  it("clamps a cell at the 70% engine ceiling", () => {
    const hot: PromosConfig = structuredClone(DEFAULT_PROMOS);
    for (const cls of CLASS_KEYS) {
      hot.visits.base.aggressive[cls] = { free: 70, premium: 70 };
    }
    expect(totalFor(hot, "aggressive", "diamond", "welcome")).toBe(70);
  });
});

describe("promos — meters", () => {
  it("Zero empty, Conservative mid, Aggressive full, on a 3-rung rail", () => {
    expect(METER_SEGMENTS).toBe(3);
    expect(giveLevel(DEFAULT_PROMOS, "zero").dots).toBe(0);
    expect(giveLevel(DEFAULT_PROMOS, "conservative").dots).toBe(2);
    expect(giveLevel(DEFAULT_PROMOS, "aggressive").dots).toBe(3);
  });

  it("visibility rail has exactly as many rungs as the ladder", () => {
    expect(visibilityDots("Low")).toBe(1);
    expect(visibilityDots("Mid")).toBe(2);
    expect(visibilityDots("High")).toBe(3);
  });

  it("a paying posture never rounds down to an empty meter", () => {
    const lopsided: PromosConfig = structuredClone(DEFAULT_PROMOS);
    for (const cls of CLASS_KEYS) {
      lopsided.visits.base.conservative[cls] = { free: 1, premium: 1 };
      lopsided.visits.base.aggressive[cls] = { free: 50, premium: 50 };
    }
    expect(giveLevel(lopsided, "conservative").dots).toBe(1);
  });
});

describe("coercePromosConfig — it comes off the wire", () => {
  it("null / junk falls back to the launch defaults", () => {
    expect(coercePromosConfig(null)).toEqual(DEFAULT_PROMOS);
    expect(coercePromosConfig("nope")).toEqual(DEFAULT_PROMOS);
    expect(coercePromosConfig([1, 2])).toEqual(DEFAULT_PROMOS);
  });

  it("keeps live values and fills only the gaps", () => {
    const cfg = coercePromosConfig({
      version: 11,
      visits: {
        base: { aggressive: { diamond: { free: 55 } } },
        bonuses: { welcome: 15 },
      },
    });
    expect(cfg.visits.base.aggressive.diamond.free).toBe(55);
    expect(cfg.visits.bonuses.welcome).toBe(15);
    // Untouched keys keep the defaults rather than blanking.
    expect(cfg.visits.base.conservative).toEqual(
      DEFAULT_PROMOS.visits.base.conservative,
    );
    expect(cfg.visits.base.aggressive.diamond.premium).toBe(
      DEFAULT_PROMOS.visits.base.aggressive.diamond.premium,
    );
    expect(cfg.visits.bonuses.google).toBe(DEFAULT_PROMOS.visits.bonuses.google);
  });

  it("drops unknown keys instead of trusting them", () => {
    const cfg = coercePromosConfig({
      version: 11,
      visits: {
        base: {
          dominant: { bronze: { free: 99 } },
          conservative: { wizard: { free: 99 }, bronze: { galaxy: 99 } },
        },
      },
    });
    expect(Object.keys(cfg.visits.base).sort()).toEqual([
      "aggressive",
      "conservative",
    ]);
    expect(Object.keys(cfg.visits.base.conservative).sort()).toEqual(
      [...CLASS_KEYS].sort(),
    );
    expect(Object.keys(cfg.visits.base.conservative.bronze).sort()).toEqual(
      [...PLAN_KEYS].sort(),
    );
  });

  it("migrates a stored v10 blob instead of blanking to defaults", () => {
    // The live blob at the v11 cut. premium was a PLAN wearing a class row.
    const cfg = coercePromosConfig({
      version: 10,
      base: {
        conservative: { standard: 10, influencer: 15, premium: 20, aura: 25 },
        aggressive: { standard: 20, influencer: 30, premium: 40, aura: 50 },
      },
      bonuses: {
        welcome: 10,
        mesita: 5,
        story: 10,
        story_influencer: 30,
        google: 10,
      },
      cap: 200,
    });
    expect(cfg.visits.base.conservative.bronze).toEqual({
      free: 10,
      premium: 20,
    });
    expect(cfg.visits.base.conservative.silver.free).toBe(15);
    expect(cfg.visits.base.conservative.diamond.free).toBe(25);
    // Gold interpolates the gap Classes v2 opened.
    expect(cfg.visits.base.conservative.gold.free).toBe(20);
    expect(cfg.cap).toBe(200);
    // The influencer story override does not survive the retired class.
    expect("story_influencer" in cfg.visits.bonuses).toBe(false);
  });
});
