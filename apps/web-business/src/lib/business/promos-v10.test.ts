import { describe, expect, it } from "vitest";
import {
  CLASS_KEYS,
  DEFAULT_PROMOS,
  METER_SEGMENTS,
  coercePromosConfig,
  giveLevel,
  totalFor,
  visibilityDots,
  type PromosConfig,
} from "./promos-v10";

// DRIFT ALARM. These are the admin console's numbers, asserted here so the two
// consoles cannot quietly disagree about what a strategy costs. If a change to
// apps/web-admin's promos.ts / distribution-model.ts doesn't land in
// promos-v10.ts, this file goes red — which is the entire point of it existing
// (MESITA-1001).
describe("promos-v10 — lockstep with the admin twin", () => {
  it("reproduces the admin expected-rate numbers exactly", () => {
    const cons = giveLevel(DEFAULT_PROMOS, "conservative");
    const aggr = giveLevel(DEFAULT_PROMOS, "aggressive");
    expect(cons.mean).toBe(19);
    expect(aggr.mean).toBe(32);
    expect([cons.p10, cons.p90]).toEqual([10, 30]);
    expect([aggr.p10, aggr.p90]).toEqual([20, 50]);
  });

  it("prices returning visits the way the engine does, not the presets", () => {
    // The bug this file exists to kill: strategies.ts says a returning
    // Standard guest on Aggressive gets free_rate = 10%. v10 pays base = 20%.
    expect(totalFor(DEFAULT_PROMOS, "aggressive", "standard", "standing")).toBe(
      20,
    );
    expect(totalFor(DEFAULT_PROMOS, "aggressive", "premium", "standing")).toBe(
      40,
    );
    // Welcome rows are where the legacy presets happened to agree.
    expect(totalFor(DEFAULT_PROMOS, "aggressive", "standard", "welcome")).toBe(
      30,
    );
    expect(totalFor(DEFAULT_PROMOS, "aggressive", "premium", "welcome")).toBe(
      50,
    );
  });

  it("clamps a cell at the 70% engine ceiling", () => {
    const hot: PromosConfig = {
      ...DEFAULT_PROMOS,
      base: { ...DEFAULT_PROMOS.base, aggressive: { standard: 70, influencer: 70, premium: 70, aura: 70 } },
    };
    expect(totalFor(hot, "aggressive", "aura", "welcome")).toBe(70);
  });
});

describe("promos-v10 — meters", () => {
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
    const lopsided: PromosConfig = {
      ...DEFAULT_PROMOS,
      base: {
        conservative: { standard: 1, influencer: 1, premium: 1, aura: 1 },
        aggressive: { standard: 50, influencer: 50, premium: 50, aura: 50 },
      },
    };
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
      base: { aggressive: { aura: 55 } },
      bonuses: { welcome: 15 },
    });
    expect(cfg.base.aggressive.aura).toBe(55);
    expect(cfg.bonuses.welcome).toBe(15);
    // Untouched keys keep the defaults rather than blanking.
    expect(cfg.base.conservative).toEqual(DEFAULT_PROMOS.base.conservative);
    expect(cfg.bonuses.google).toBe(DEFAULT_PROMOS.bonuses.google);
  });

  it("drops unknown keys instead of trusting them", () => {
    const cfg = coercePromosConfig({
      base: { dominant: { standard: 99 }, conservative: { wizard: 99 } },
    });
    expect(Object.keys(cfg.base).sort()).toEqual(["aggressive", "conservative"]);
    expect(Object.keys(cfg.base.conservative).sort()).toEqual(
      [...CLASS_KEYS].sort(),
    );
  });

  it("honours an explicit null Influencer override", () => {
    expect(
      coercePromosConfig({ bonuses: { story_influencer: null } }).bonuses
        .story_influencer,
    ).toBeNull();
  });
});
