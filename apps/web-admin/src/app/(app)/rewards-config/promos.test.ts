import { describe, expect, it } from "vitest";

import {
  ACTION_KEYS,
  ALLOWED_RATES,
  CLASS_KEYS,
  DEFAULT_PROMOS,
  STRATEGY_KEYS,
  coercePromosConfig,
  legacyRulesFrom,
  seedFromLegacyRules,
  snapCap,
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
      base: {
        conservative: { standard: 12, bogus: 55 },
        dominant: { standard: 60 }, // retired strategy — dropped
      },
      bonuses: { welcome: 73, mesita: -4 },
      cap: 480,
      extra: true,
    });
    expect(cfg.base.conservative.standard).toBe(10);
    expect(cfg.base.aggressive).toEqual(DEFAULT_PROMOS.base.aggressive);
    expect(cfg.bonuses.welcome).toBe(70); // ceiling
    expect(cfg.bonuses.mesita).toBe(0); // ≤0 → off
    expect(cfg.cap).toBe(500);
    expect("extra" in cfg).toBe(false);
  });

  it("keeps the nullable influencer override tri-state (decision 2A)", () => {
    expect(
      coercePromosConfig({ bonuses: { story_influencer: null } }).bonuses
        .story_influencer,
    ).toBeNull();
    expect(
      coercePromosConfig({ bonuses: { story_influencer: 25 } }).bonuses
        .story_influencer,
    ).toBe(25);
    // absent → default (30), not null
    expect(
      coercePromosConfig({ bonuses: {} }).bonuses.story_influencer,
    ).toBe(DEFAULT_PROMOS.bonuses.story_influencer);
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

  it("snapCap lands on the categorical ladder", () => {
    expect(snapCap(480)).toBe(500);
    expect(snapCap(50)).toBe(200);
    expect(snapCap(99999)).toBe(1000);
    expect(snapCap(undefined)).toBe(500);
  });
});

describe("totalFor + legacyRulesFrom (the engine bridge)", () => {
  it("standing total is the bare base", () => {
    expect(totalFor(DEFAULT_PROMOS, "aggressive", "premium", "standing")).toBe(
      40,
    );
  });

  it("influencer story uses the override; others the universal bonus", () => {
    expect(totalFor(DEFAULT_PROMOS, "conservative", "influencer", "story")).toBe(
      15 + 30,
    );
    expect(totalFor(DEFAULT_PROMOS, "conservative", "premium", "story")).toBe(
      20 + 10,
    );
  });

  it("a null override inherits the universal story bonus", () => {
    const cfg = coercePromosConfig({
      ...DEFAULT_PROMOS,
      bonuses: { ...DEFAULT_PROMOS.bonuses, story_influencer: null },
    });
    expect(totalFor(cfg, "conservative", "influencer", "story")).toBe(15 + 10);
  });

  it("emits the complete 40-rule legacy set, on-grid and ≤70", () => {
    const rules = legacyRulesFrom(DEFAULT_PROMOS);
    expect(rules).toHaveLength(
      STRATEGY_KEYS.length * CLASS_KEYS.length * ACTION_KEYS.length,
    );
    for (const r of rules) {
      expect(ALLOWED_RATES).toContain(r.discount_percent);
    }
    // Spot-check the clamp: aggressive aura + welcome = 50 + 10 = 60 (≤70).
    const cell = rules.find(
      (r) =>
        r.strategy === "aggressive" &&
        r.class === "aura" &&
        r.action === "welcome",
    );
    expect(cell?.discount_percent).toBe(60);
  });
});

describe("seedFromLegacyRules", () => {
  it("returns null when there is nothing to seed from", () => {
    expect(seedFromLegacyRules(undefined)).toBeNull();
    expect(seedFromLegacyRules([])).toBeNull();
    expect(seedFromLegacyRules([{ nope: 1 }])).toBeNull();
  });

  it("round-trips a v10-derived table back to the same knobs", () => {
    const seeded = seedFromLegacyRules(legacyRulesFrom(DEFAULT_PROMOS));
    expect(seeded).not.toBeNull();
    expect(seeded?.base).toEqual(DEFAULT_PROMOS.base);
    expect(seeded?.bonuses).toEqual(DEFAULT_PROMOS.bonuses);
  });

  it("reads the v9 formula table: exact bases, universal bonuses, no override", () => {
    // The v9 stored shape: rate = 5 + type + class + strategy. Story−standing
    // is 10 for EVERY class (the class step cancels), so the override seeds
    // to null ("Same as universal").
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
    expect(seeded?.base.conservative).toEqual({
      standard: 5,
      influencer: 10,
      premium: 15,
      aura: 20,
    });
    expect(seeded?.base.aggressive.aura).toBe(30);
    expect(seeded?.bonuses).toEqual({
      welcome: 20,
      mesita: 5,
      story: 10,
      story_influencer: null,
      google: 15,
    });
  });
});
