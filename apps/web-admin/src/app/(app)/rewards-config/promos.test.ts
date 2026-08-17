import { describe, expect, it } from "vitest";

import { snapDiscountCap } from "@/lib/business/strategies";
import {
  ACTION_KEYS,
  ALLOWED_RATES,
  DEFAULT_PROMOS,
  LEGACY_CLASS_IDENTITY,
  STRATEGY_KEYS,
  coercePromosConfig,
  legacyRulesFrom,
  modelWarnings,
  seedFromLegacyRules,
  snapRate,
  totalFor,
} from "./promos";

describe("coercePromosConfig", () => {
  it("round-trips the defaults", () => {
    expect(coercePromosConfig(DEFAULT_PROMOS)).toEqual(DEFAULT_PROMOS);
  });

  it("falls back to defaults on garbage", () => {
    expect(coercePromosConfig(null)).toEqual(DEFAULT_PROMOS);
    expect(coercePromosConfig([])).toEqual(DEFAULT_PROMOS);
    expect(coercePromosConfig("nope")).toEqual(DEFAULT_PROMOS);
  });

  it("snaps rates onto the 5% grid and keeps unknown keys out", () => {
    const cfg = coercePromosConfig({
      version: 11,
      visits: {
        base: {
          conservative: { bronze: { free: 12, bogus: 55 }, nope: {} },
          dominant: { bronze: { free: 60 } }, // retired strategy — dropped
        },
        bonuses: { welcome: 73, mesita: -4 },
      },
      cap: 480,
      extra: true,
    });
    expect(cfg.visits.base.conservative.bronze.free).toBe(10);
    expect(cfg.visits.base.aggressive).toEqual(
      DEFAULT_PROMOS.visits.base.aggressive,
    );
    expect(cfg.visits.bonuses.welcome).toBe(70); // ceiling
    expect(cfg.visits.bonuses.mesita).toBe(0); // ≤0 → off
    expect(cfg.cap).toBe(500);
    expect("extra" in cfg).toBe(false);
  });

  it("never lets a stored blob un-park orders", () => {
    const cfg = coercePromosConfig({
      version: 11,
      orders: { soon: false, base: {}, bonuses: {} },
    });
    expect(cfg.orders.soon).toBe(true);
  });
});

describe("v10 → v11 migration", () => {
  // The live v10 blob at the time of the cut (cap 200).
  const V10 = {
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
  };

  it("splits the conflated axes: premium was a PLAN, not a class", () => {
    const cfg = coercePromosConfig(V10);
    // standard → bronze·free, premium → bronze·premium.
    expect(cfg.visits.base.conservative.bronze).toEqual({
      free: 10,
      premium: 20,
    });
    expect(cfg.visits.base.aggressive.bronze).toEqual({
      free: 20,
      premium: 40,
    });
    // influencer → silver·free, aura → diamond·free.
    expect(cfg.visits.base.conservative.silver.free).toBe(15);
    expect(cfg.visits.base.conservative.diamond.free).toBe(25);
  });

  it("carries the plan uplift across every class and interpolates gold", () => {
    const cfg = coercePromosConfig(V10);
    // Uplift = bronze premium − free = +10 conservative, +20 aggressive.
    expect(cfg.visits.base.conservative.silver.premium).toBe(15 + 10);
    expect(cfg.visits.base.conservative.diamond.premium).toBe(25 + 10);
    expect(cfg.visits.base.aggressive.diamond.premium).toBe(50 + 20);
    // Gold has no v10 ancestor — it splits the silver→diamond gap.
    expect(cfg.visits.base.conservative.gold.free).toBe(20);
    expect(cfg.visits.base.aggressive.gold.free).toBe(40);
  });

  it("drops the influencer story override and keeps the cap", () => {
    const cfg = coercePromosConfig(V10);
    expect(cfg.visits.bonuses).toEqual({
      welcome: 10,
      mesita: 5,
      story: 10,
      google: 10,
    });
    expect("story_influencer" in cfg.visits.bonuses).toBe(false);
    expect(cfg.cap).toBe(200);
  });

  it("clamps an uplifted cell to the 70% ceiling", () => {
    const cfg = coercePromosConfig({
      ...V10,
      base: {
        ...V10.base,
        aggressive: { standard: 30, influencer: 40, premium: 60, aura: 60 },
      },
    });
    // uplift = 30; diamond free 60 + 30 would be 90.
    expect(cfg.visits.base.aggressive.diamond.premium).toBe(70);
  });
});

describe("snap helpers", () => {
  it("snapRate clamps to [5,70] and zeroes non-positives", () => {
    expect(snapRate(7, 0)).toBe(5);
    expect(snapRate(8, 0)).toBe(10);
    expect(snapRate(120, 0)).toBe(70);
    expect(snapRate(-3, 99)).toBe(0);
    expect(snapRate("x", 15)).toBe(15);
  });

  it("snapDiscountCap lands on the categorical ladder", () => {
    expect(snapDiscountCap(480)).toBe(500);
    expect(snapDiscountCap(50)).toBe(200);
    expect(snapDiscountCap(99999)).toBe(1000);
    expect(snapDiscountCap(undefined)).toBe(500);
  });
});

describe("totalFor + legacyRulesFrom (the engine bridge)", () => {
  it("standing total is the bare base for that class and plan", () => {
    expect(
      totalFor(DEFAULT_PROMOS, "aggressive", "bronze", "premium", "standing"),
    ).toBe(40);
    expect(
      totalFor(DEFAULT_PROMOS, "aggressive", "bronze", "free", "standing"),
    ).toBe(20);
  });

  it("every class pays the same universal story bonus (no override)", () => {
    for (const cls of ["bronze", "silver", "gold", "diamond"] as const) {
      const base = DEFAULT_PROMOS.visits.base.conservative[cls].free;
      expect(totalFor(DEFAULT_PROMOS, "conservative", cls, "free", "story")).toBe(
        base + DEFAULT_PROMOS.visits.bonuses.story,
      );
    }
  });

  it("emits the complete 40-rule legacy set, on-grid and ≤70", () => {
    const rules = legacyRulesFrom(DEFAULT_PROMOS);
    const legacyClassCount = Object.keys(LEGACY_CLASS_IDENTITY).length;
    expect(rules).toHaveLength(
      STRATEGY_KEYS.length * legacyClassCount * ACTION_KEYS.length,
    );
    for (const r of rules) {
      expect(ALLOWED_RATES).toContain(r.discount_percent);
    }
    // The legacy `premium` row is the PLAN uplift at the base class, not a
    // class of its own: aggressive bronze·premium (40) + welcome (10) = 50.
    const premiumWelcome = rules.find(
      (r) =>
        r.strategy === "aggressive" &&
        r.class === "premium" &&
        r.action === "welcome",
    );
    expect(premiumWelcome?.discount_percent).toBe(50);
    // aura → diamond·free: 50 + 10 = 60 (≤70).
    const auraWelcome = rules.find(
      (r) =>
        r.strategy === "aggressive" &&
        r.class === "aura" &&
        r.action === "welcome",
    );
    expect(auraWelcome?.discount_percent).toBe(60);
  });
});

describe("modelWarnings", () => {
  it("stays silent on the defaults — the shipped ladder is well-formed", () => {
    expect(modelWarnings(DEFAULT_PROMOS)).toEqual([]);
  });

  it("flags Google failing to out-pay the repeatable Story", () => {
    // The one-shot rung must beat the one a guest can repeat every visit.
    const cfg = structuredClone(DEFAULT_PROMOS);
    cfg.visits.bonuses.google = cfg.visits.bonuses.story;
    expect(modelWarnings(cfg).map((w) => w.key)).toEqual(["google-vs-story"]);
  });

  it("flags an inverted class ladder", () => {
    const cfg = structuredClone(DEFAULT_PROMOS);
    cfg.visits.base.conservative.diamond.free = 5;
    expect(modelWarnings(cfg).some((w) => w.key.startsWith("class-order"))).toBe(
      true,
    );
  });

  it("flags a Premium plan that pays less than Free", () => {
    const cfg = structuredClone(DEFAULT_PROMOS);
    cfg.visits.base.aggressive.gold.premium = 5;
    expect(modelWarnings(cfg).some((w) => w.key.startsWith("plan-uplift"))).toBe(
      true,
    );
  });
});

describe("seedFromLegacyRules", () => {
  it("returns null when there is nothing to seed from", () => {
    expect(seedFromLegacyRules(undefined)).toBeNull();
    expect(seedFromLegacyRules([])).toBeNull();
    expect(seedFromLegacyRules([{ nope: 1 }])).toBeNull();
  });

  it("round-trips a v11-derived table back to the same knobs", () => {
    const seeded = seedFromLegacyRules(legacyRulesFrom(DEFAULT_PROMOS));
    expect(seeded).not.toBeNull();
    expect(seeded?.visits.base).toEqual(DEFAULT_PROMOS.visits.base);
    expect(seeded?.visits.bonuses).toEqual(DEFAULT_PROMOS.visits.bonuses);
  });

  it("reads the v9 formula table through the same axis split", () => {
    // The v9 stored shape: rate = 5 + type + class + strategy.
    const TYPE: Record<string, number> = {
      standing: 0,
      mesita_review: 5,
      story: 10,
      review: 15,
      welcome: 20,
    };
    const CLS: Record<string, number> = {
      standard: 0,
      influencer: 5,
      premium: 10,
      aura: 15,
    };
    const STRAT: Record<string, number> = { conservative: 0, aggressive: 10 };
    const rules = [];
    for (const s of Object.keys(STRAT))
      for (const c of Object.keys(CLS))
        for (const a of Object.keys(TYPE))
          rules.push({
            strategy: s,
            class: c,
            action: a,
            discount_percent: 5 + TYPE[a] + CLS[c] + STRAT[s],
          });

    const seeded = seedFromLegacyRules(rules);
    // standard 5 → bronze·free; premium 15 → bronze·premium (uplift +10).
    expect(seeded?.visits.base.conservative.bronze).toEqual({
      free: 5,
      premium: 15,
    });
    expect(seeded?.visits.base.conservative.silver).toEqual({
      free: 10,
      premium: 20,
    });
    expect(seeded?.visits.base.conservative.diamond).toEqual({
      free: 20,
      premium: 30,
    });
    expect(seeded?.visits.bonuses).toEqual({
      welcome: 20,
      mesita: 5,
      story: 10,
      google: 15,
    });
  });
});
