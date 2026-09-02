import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { snapDiscountCap } from "@/lib/business/strategies";
import {
  DEFAULT_PROMOS,
  additivityError,
  coercePromosConfig,
  deriveOrders,
  deriveVisits,
  expandOrders,
  expandVisits,
  modelWarnings,
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
    // A FLAT bonus body fans out to every strategy (the legacy shape).
    expect(cfg.visits.bonuses.conservative.welcome).toBe(70); // ceiling
    expect(cfg.visits.bonuses.conservative.mesita).toBe(0); // ≤0 → off
    expect(cfg.visits.bonuses.aggressive.welcome).toBe(70);
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
    const expected = { welcome: 10, mesita: 5, story: 10, google: 10 };
    expect(cfg.visits.bonuses.conservative).toEqual(expected);
    expect(cfg.visits.bonuses.aggressive).toEqual(expected);
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

describe("totalFor (the engine bridge)", () => {
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
        base + DEFAULT_PROMOS.visits.bonuses.conservative.story,
      );
    }
  });
});

describe("modelWarnings", () => {
  it("stays silent on the defaults — the shipped ladder is well-formed", () => {
    expect(modelWarnings(DEFAULT_PROMOS)).toEqual([]);
  });

  it("flags Google failing to out-pay the repeatable Story", () => {
    // The one-shot rung must beat the one a guest can repeat every visit.
    const cfg = structuredClone(DEFAULT_PROMOS);
    cfg.visits.bonuses.aggressive.google = cfg.visits.bonuses.aggressive.story;
    expect(modelWarnings(cfg).map((w) => w.key)).toEqual([
      "google-vs-story-aggressive",
    ]);
  });

  it("no longer reports class order or plan uplift — the guard makes them unstorable", () => {
    // Both used to be warnings. additivityError refuses to store them now, so
    // warning about them would be theatre. Covered in the guard suite below.
    const inverted = structuredClone(DEFAULT_PROMOS);
    inverted.visits.base.conservative.diamond.free = 5;
    expect(modelWarnings(inverted)).toEqual([]);
    expect(additivityError(inverted.visits.base)).not.toBeNull();
  });
});

// ── components: the five-box editor's view of the stored grid ────────────

describe("deriveVisits / expandVisits", () => {
  it("round-trips the shipped grid exactly", () => {
    const base = DEFAULT_PROMOS.visits.base;
    expect(expandVisits(deriveVisits(base))).toEqual(base);
  });

  it("pins bronze and free to zero — they ARE the baseline", () => {
    const c = deriveVisits(DEFAULT_PROMOS.visits.base);
    for (const s of ["conservative", "aggressive"] as const) {
      expect(c[s].class.bronze).toBe(0);
      expect(c[s].plan.free).toBe(0);
    }
  });

  it("reads the real per-strategy steps off the shipped grid", () => {
    const c = deriveVisits(DEFAULT_PROMOS.visits.base);
    // Class climbs +5 on Conservative and +10 on Aggressive; plan adds
    // +10 vs +20. A strategy-invariant step would halve every elevated rate.
    expect(c.conservative.class).toEqual({
      bronze: 0,
      silver: 5,
      gold: 10,
      diamond: 15,
    });
    expect(c.aggressive.class).toEqual({
      bronze: 0,
      silver: 10,
      gold: 20,
      diamond: 30,
    });
    expect(c.conservative.plan.premium).toBe(10);
    expect(c.aggressive.plan.premium).toBe(20);
  });

  it("clamps an over-ceiling component sum at 70", () => {
    const c = deriveVisits(DEFAULT_PROMOS.visits.base);
    c.aggressive.base = 60;
    expect(expandVisits(c).aggressive.diamond.premium).toBe(70);
  });

  it("orders round-trips too, with no class axis", () => {
    const base = DEFAULT_PROMOS.orders.base;
    expect(expandOrders(deriveOrders(base))).toEqual(base);
  });
});

describe("additivityError — the guard", () => {
  it("passes the shipped grid", () => {
    expect(additivityError(DEFAULT_PROMOS.visits.base)).toBeNull();
  });

  it("rejects a cell set on its own", () => {
    const base = structuredClone(DEFAULT_PROMOS.visits.base);
    base.aggressive.gold.premium = 55; // ladder says 60
    expect(additivityError(base)).toMatch(/cannot be set on its own/);
  });

  it("rejects an inverted class ladder even when every offset is >= 0", () => {
    // The subtle one: steps are OFFSETS FROM BASE, not rung-to-rung deltas,
    // so "all steps >= 0" does not imply monotonic. silver +15 / gold +5 are
    // both non-negative and still invert.
    const base = structuredClone(DEFAULT_PROMOS.visits.base);
    const floor = base.conservative.bronze.free;
    base.conservative.silver.free = floor + 15;
    base.conservative.silver.premium = floor + 15 + 10;
    base.conservative.gold.free = floor + 5;
    base.conservative.gold.premium = floor + 5 + 10;
    expect(additivityError(base)).toMatch(/ladder would invert/);
  });

  it("rejects a Premium plan that pays less than Free", () => {
    const base = structuredClone(DEFAULT_PROMOS.visits.base);
    for (const cls of ["bronze", "silver", "gold", "diamond"] as const) {
      base.aggressive[cls].premium = base.aggressive[cls].free - 5;
    }
    expect(additivityError(base)).toMatch(/cost the guest money/);
  });
});

describe("bonuses are per strategy", () => {
  it("a PER-STRATEGY body survives the round trip", () => {
    const cfg = coercePromosConfig({
      version: 11,
      visits: {
        bonuses: {
          conservative: { welcome: 10, mesita: 5, story: 10, google: 15 },
          aggressive: { welcome: 20, mesita: 10, story: 20, google: 25 },
        },
      },
    });
    expect(cfg.visits.bonuses.aggressive.google).toBe(25);
    expect(cfg.visits.bonuses.conservative.google).toBe(15);
  });

  it("totalFor pays the strategy's OWN action bonus", () => {
    const cfg = structuredClone(DEFAULT_PROMOS);
    cfg.visits.bonuses.aggressive.story = 30;
    // Aggressive bronze·free base is 20; its own story bonus now adds 30.
    expect(totalFor(cfg, "aggressive", "bronze", "free", "story")).toBe(50);
    // Conservative is untouched by that edit.
    expect(totalFor(cfg, "conservative", "bronze", "free", "story")).toBe(
      10 + cfg.visits.bonuses.conservative.story,
    );
  });
});

describe("Tiers HTML prices visits only", () => {
  it("has no Orders or prepaid knobs", () => {
    const src = readFileSync(join(__dirname, "TiersClient.tsx"), "utf8");
    expect(src).not.toContain("OrdersPromosSoon");
    expect(src).not.toContain('context="orders"');
    expect(src).not.toContain("setOrders");
    expect(src).not.toContain("ResolvedLedger");
    expect(src).not.toContain("SectionCard");
    expect(src).toContain("<table");
    expect(src).not.toContain("grid-rows-subgrid");
    expect(src).not.toContain("RowGroup");
    expect(src).not.toContain("BoxRow");
    const ui = readFileSync(join(__dirname, "promos-ui.tsx"), "utf8");
    // Two rate columns plus the rung column fit 318px at a 390px viewport
    // only while the control narrows below sm (MESITA-1421).
    expect(ui).toContain("w-20");
    expect(ui).toContain("sm:w-24");
    expect(ui).toContain("h-9");
    expect(ui).toContain("appearance-none");
    expect(ui).not.toContain("STRATEGY_COLUMN_TRACKS");
    expect(ui).not.toContain("BoxRow");
  });

  it("states ENFORCED once for the whole table, not per column", () => {
    const src = readFileSync(join(__dirname, "TiersClient.tsx"), "utf8");
    expect(src.match(/KnobStatus kind="enforced"/g)).toHaveLength(1);
    // The rung column anchors the table on glass too narrow for it, through
    // the shared helper rather than a route-local sticky (#1466).
    expect(src).toContain("STICKY_COL_CELL");
    // A column head is the strategy name alone — the badge sat under both,
    // saying the same thing twice and widening the table off a phone.
    expect(src).not.toMatch(/<div className="mt-1\.5">\s*<KnobStatus/);
  });

  it("picks Conservative and Aggressive only", () => {
    const src = readFileSync(join(__dirname, "TiersClient.tsx"), "utf8");
    expect(src).toContain("LIVE_STRATEGY_KEYS");
    expect(src).not.toContain("lg:grid-cols-3");
    expect(src).not.toContain('"dominant"');
  });
});

describe("Rewards Config is one page", () => {
  it("has three super boxes and no tab nav", () => {
    const shell = readFileSync(join(__dirname, "layout.tsx"), "utf8");
    const page = readFileSync(join(__dirname, "page.tsx"), "utf8");
    const nav = readFileSync(join(__dirname, "nav.ts"), "utf8");
    expect(shell).not.toContain("ConfigTabNav");
    // Chrome comes from the shared kit, never a route-local shim, and the
    // title is the rail label — the eyebrow already says Product · Rewards.
    expect(shell).toContain("ConfigPageLayout");
    expect(shell).toContain('title="Rewards"');
    expect(shell).not.toContain('title="Rewards Config"');
    expect(existsSync(join(__dirname, "PromosLayoutShell.tsx"))).toBe(false);
    // The scope line is stated ONCE, by the layout — no box repeats it.
    expect(shell).toContain("Visit rewards only");
    expect(page).not.toContain("Visit rewards only");
    expect(nav).not.toContain("PROMOS_SUBROUTES");
    expect(page).toContain('title="Strategies"');
    expect(page).toContain('title="Discount Cap"');
    expect(page).toContain('title="Expected Distribution"');
    expect(page).toContain("TiersClient");
    expect(page).toContain("DiscountCapClient");
    expect(page).toContain("PromosDistributionClient");
    expect(page).toContain("PromosSaveFooter");
    expect(page).toContain("PromosCalculator");
    expect(page.indexOf("Strategies")).toBeLessThan(
      page.indexOf("Discount Cap"),
    );
    expect(page.indexOf("Discount Cap")).toBeLessThan(
      page.indexOf("Expected Distribution"),
    );
    expect(page.indexOf("PromosDistributionClient")).toBeLessThan(
      page.indexOf("PromosCalculator"),
    );
    const ledger = readFileSync(join(__dirname, "ResolvedLedger.tsx"), "utf8");
    expect(ledger).toContain('title="Calculator"');
    expect(ledger).not.toMatch(/>\s*Resolved\s*</);
    const tiers = readFileSync(join(__dirname, "tiers/page.tsx"), "utf8");
    const dist = readFileSync(
      join(__dirname, "distribution/page.tsx"),
      "utf8",
    );
    expect(tiers).toContain('redirect("/rewards-config")');
    expect(dist).toContain('redirect("/rewards-config")');
  });
});
