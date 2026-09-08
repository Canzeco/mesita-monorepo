import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { snapDiscountCap } from "@/lib/business/strategies";
import {
  DEFAULT_PROMOS,
  additivityError,
  coercePromosConfig,
  deriveVisits,
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
      version: 12,
      visits: {
        base: { conservative: { bronze: 12, bogus: 55 }, nope: {} },
        bonuses: { welcome: 73, mesita: -4 },
      },
      cap: 480,
      extra: true,
    });
    expect(cfg.visits.base.conservative.bronze).toBe(10);
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
      version: 12,
      orders: { soon: false, base: {}, bonuses: {} },
    });
    expect(cfg.orders.soon).toBe(true);
  });
});

describe("v10 → v12 migration", () => {
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

  it("DROPS the `premium` row — it was the plan, and v12 does not price it", () => {
    const cfg = coercePromosConfig(V10);
    // standard → bronze, influencer → silver, aura → diamond. The premium row
    // is not folded in as an uplift; that would smuggle the deleted axis back.
    expect(cfg.visits.base.conservative.bronze).toBe(10);
    expect(cfg.visits.base.aggressive.bronze).toBe(20);
    expect(cfg.visits.base.conservative.silver).toBe(15);
    expect(cfg.visits.base.conservative.diamond).toBe(25);
  });

  it("interpolates gold, which has no v10 ancestor", () => {
    const cfg = coercePromosConfig(V10);
    expect(cfg.visits.base.conservative.gold).toBe(20); // mid(15, 25)
    expect(cfg.visits.base.aggressive.gold).toBe(40); // mid(30, 50)
  });

  it("drops the influencer story override and keeps the cap", () => {
    const cfg = coercePromosConfig(V10);
    const expected = { welcome: 10, mesita: 5, story: 10, google: 10 };
    expect(cfg.visits.bonuses.conservative).toEqual(expected);
    expect(cfg.visits.bonuses.aggressive).toEqual(expected);
    expect(cfg.cap).toBe(200);
  });

  it("snaps every migrated cell onto the grid and under the ceiling", () => {
    const cfg = coercePromosConfig({
      ...V10,
      base: {
        ...V10.base,
        aggressive: { standard: 30, influencer: 40, premium: 60, aura: 90 },
      },
    });
    expect(cfg.visits.base.aggressive.diamond).toBe(70); // 90 clamps
    expect(cfg.visits.base.aggressive.bronze).toBe(30);
  });
});

// ── v11 → v12: the migration that runs on the live blob at deploy ────────

describe("v11 → v12 migration", () => {
  const V11 = {
    version: 11,
    visits: {
      base: {
        conservative: {
          bronze: { free: 10, premium: 20 },
          silver: { free: 15, premium: 25 },
          gold: { free: 20, premium: 30 },
          diamond: { free: 25, premium: 35 },
        },
        aggressive: {
          bronze: { free: 20, premium: 40 },
          silver: { free: 30, premium: 50 },
          gold: { free: 40, premium: 60 },
          diamond: { free: 50, premium: 70 },
        },
        dominant: {
          bronze: { free: 40, premium: 55 },
          silver: { free: 45, premium: 60 },
          gold: { free: 50, premium: 65 },
          diamond: { free: 55, premium: 70 },
        },
      },
      bonuses: {
        conservative: { welcome: 10, mesita: 5, story: 10, google: 15 },
        aggressive: { welcome: 10, mesita: 5, story: 10, google: 15 },
        dominant: { welcome: 10, mesita: 10, story: 10, google: 15 },
      },
    },
    orders: {
      base: {
        conservative: { free: 5, premium: 10 },
        aggressive: { free: 10, premium: 15 },
        dominant: { free: 15, premium: 20 },
      },
      bonuses: {
        conservative: { welcome: 5, mesita: 5, story: 5, google: 10 },
        aggressive: { welcome: 5, mesita: 5, story: 5, google: 10 },
        dominant: { welcome: 10, mesita: 10, story: 10, google: 15 },
      },
      soon: true,
    },
    cap: 500,
  };

  it("keeps the FREE column and drops every premium cell", () => {
    const cfg = coercePromosConfig(V11);
    expect(cfg.version).toBe(12);
    expect(cfg.visits.base.conservative).toEqual({
      bronze: 10,
      silver: 15,
      gold: 20,
      diamond: 25,
    });
    expect(cfg.orders.base).toEqual({
      conservative: 5,
      aggressive: 10,
      dominant: 15,
    });
  });

  it("the LIVE v11 defaults land exactly on the v12 defaults — no bill moves", () => {
    // The blob in app_config is v11 until the operator's first save, so this
    // equality IS the no-money-moves guarantee for the deploy.
    expect(coercePromosConfig(V11)).toEqual(DEFAULT_PROMOS);
  });

  it("detects the v11 shape even with no version tag", () => {
    const untagged = structuredClone(V11) as Record<string, unknown>;
    delete untagged.version;
    expect(coercePromosConfig(untagged).visits.base.conservative.silver).toBe(15);
  });

  it("keeps operator tuning that lived on the free column", () => {
    const tuned = structuredClone(V11);
    tuned.visits.base.aggressive.bronze.free = 25;
    tuned.visits.base.aggressive.silver.free = 35;
    tuned.visits.base.aggressive.gold.free = 45;
    tuned.visits.base.aggressive.diamond.free = 55;
    expect(coercePromosConfig(tuned).visits.base.aggressive).toEqual({
      bronze: 25,
      silver: 35,
      gold: 45,
      diamond: 55,
    });
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
  it("standing total is the bare base for that class", () => {
    expect(totalFor(DEFAULT_PROMOS, "aggressive", "bronze", "standing")).toBe(20);
    expect(totalFor(DEFAULT_PROMOS, "aggressive", "diamond", "standing")).toBe(50);
  });

  it("every class pays the same universal story bonus (no override)", () => {
    for (const cls of ["bronze", "silver", "gold", "diamond"] as const) {
      const base = DEFAULT_PROMOS.visits.base.conservative[cls];
      expect(totalFor(DEFAULT_PROMOS, "conservative", cls, "story")).toBe(
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

  it("no longer reports class order — the guard makes it unstorable", () => {
    // It used to be a warning. additivityError refuses to store it now, so
    // warning about it would be theatre. Covered in the guard suite below.
    const inverted = structuredClone(DEFAULT_PROMOS);
    inverted.visits.base.conservative.diamond = 5;
    expect(modelWarnings(inverted)).toEqual([]);
    expect(additivityError(inverted.visits.base)).not.toBeNull();
  });
});

// ── components: the editor's view of the stored grid ────────────────────

describe("deriveVisits / expandVisits", () => {
  it("round-trips the shipped grid exactly", () => {
    const base = DEFAULT_PROMOS.visits.base;
    expect(expandVisits(deriveVisits(base))).toEqual(base);
  });

  it("pins bronze to zero — it IS the baseline", () => {
    const c = deriveVisits(DEFAULT_PROMOS.visits.base);
    for (const s of ["conservative", "aggressive"] as const) {
      expect(c[s].class.bronze).toBe(0);
    }
  });

  it("reads the real per-strategy steps off the shipped grid", () => {
    const c = deriveVisits(DEFAULT_PROMOS.visits.base);
    // Class climbs +5 on Conservative and +10 on Aggressive. A
    // strategy-invariant step would halve every elevated rate.
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
  });

  it("clamps an over-ceiling component sum at 70", () => {
    const c = deriveVisits(DEFAULT_PROMOS.visits.base);
    c.aggressive.base = 60;
    expect(expandVisits(c).aggressive.diamond).toBe(70);
  });

  it("orders is a plain scalar per strategy — no components left to derive", () => {
    // It was base + planStep. With plan gone a remote row is one number, so
    // deriveOrders/expandOrders were deleted rather than kept as identity
    // functions. Pinned so a future reader does not restore them.
    for (const s of ["conservative", "aggressive", "dominant"] as const) {
      expect(typeof DEFAULT_PROMOS.orders.base[s]).toBe("number");
    }
  });
});

describe("additivityError — the guard", () => {
  it("passes the shipped grid", () => {
    expect(additivityError(DEFAULT_PROMOS.visits.base)).toBeNull();
  });

  it("accepts any on-grid single-axis cell — the expansion check is GONE", () => {
    // v11 also refused a cell that did not equal base + class + plan. With one
    // axis the class offset is derived from the cell itself, so that check can
    // never fail; it was deleted rather than left as a test that always
    // passes. Pinned here so a future reader does not "restore" it.
    const base = structuredClone(DEFAULT_PROMOS.visits.base);
    base.aggressive.gold = 45; // still climbing: 20 / 30 / 45 / 50
    expect(additivityError(base)).toBeNull();
  });

  it("rejects an inverted class ladder even when every offset is >= 0", () => {
    // The subtle one: steps are OFFSETS FROM BASE, not rung-to-rung deltas,
    // so "all steps >= 0" does not imply monotonic. silver +15 / gold +5 are
    // both non-negative and still invert.
    const base = structuredClone(DEFAULT_PROMOS.visits.base);
    const floor = base.conservative.bronze;
    base.conservative.silver = floor + 15;
    base.conservative.gold = floor + 5;
    expect(additivityError(base)).toMatch(/ladder would invert/);
  });
});

describe("bonuses are per strategy", () => {
  it("a PER-STRATEGY body survives the round trip", () => {
    const cfg = coercePromosConfig({
      version: 12,
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
    // Aggressive bronze base is 20; its own story bonus now adds 30.
    expect(totalFor(cfg, "aggressive", "bronze", "story")).toBe(50);
    // Conservative is untouched by that edit.
    expect(totalFor(cfg, "conservative", "bronze", "story")).toBe(
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
    expect(src.match(/KnobState kind="enforced"/g)).toHaveLength(1);
    // The rung column anchors the table on glass too narrow for it, through
    // the shared helper rather than a route-local sticky (#1466).
    expect(src).toContain("STICKY_COL_CELL");
    // A column head is the strategy name alone — the badge sat under both,
    // saying the same thing twice and widening the table off a phone.
    expect(src).not.toMatch(/<div className="mt-1\.5">\s*<KnobState/);
  });

  it("picks Conservative and Aggressive only", () => {
    const src = readFileSync(join(__dirname, "TiersClient.tsx"), "utf8");
    expect(src).toContain("LIVE_STRATEGY_KEYS");
    expect(src).not.toContain("lg:grid-cols-3");
    expect(src).not.toContain('"dominant"');
  });
});

describe("Rewards Config is one page", () => {
  it("has two super boxes then Save, and no tab nav", () => {
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
    expect(page).toContain("TiersClient");
    expect(page).toContain("DiscountCapClient");
    expect(page).toContain("PromosSaveFooter");
    expect(page.indexOf("Strategies")).toBeLessThan(
      page.indexOf("Discount Cap"),
    );
    // Save is LAST on the page now that nothing follows it. Compare against
    // the JSX usage, not the bare name — the import list carries every name at
    // the top of the file and would make any ordering assertion trivially true.
    expect(page.indexOf("Discount Cap")).toBeLessThan(
      page.indexOf("<PromosSaveFooter />"),
    );

    // The Expected Distribution box is GONE (MESITA-1705) — the assumptions
    // simulator AND the Calculator that lived inside it. Absence guards, not
    // just a deletion, so the box cannot drift back in unnoticed. existsSync
    // and not readFileSync on purpose: a readFileSync on a deleted component
    // ENOENTs the whole test file rather than failing one assertion, which is
    // exactly the trap this rewrite walked into.
    // STRUCTURAL, never bare substrings: page.tsx's own comment records why
    // the box was removed and names all three components, so
    // `not.toContain("PromosCalculator")` fails on the sentence explaining the
    // decision — and the cheapest way to green it would be deleting that
    // sentence. Same trap passport-axes.test.ts documents. Assert on imports
    // and JSX instead.
    expect(page).not.toContain('title="Expected Distribution"');
    for (const gone of [
      "PromosDistributionClient",
      "PromosCalculator",
      "ResolvedLedger",
    ]) {
      expect(page).not.toContain(`from "./${gone}"`);
      expect(page).not.toContain(`<${gone} `);
      expect(page).not.toContain(`<${gone}/>`);
      expect(page).not.toContain(`<${gone} />`);
    }
    expect(existsSync(join(__dirname, "ResolvedLedger.tsx"))).toBe(false);
    expect(existsSync(join(__dirname, "PromosCalculator.tsx"))).toBe(false);
    expect(existsSync(join(__dirname, "PromosDistributionClient.tsx"))).toBe(false);
    expect(existsSync(join(__dirname, "distribution-model.ts"))).toBe(false);

    // The redirect stays: old bookmarks land on the page, not a 404.
    const tiers = readFileSync(join(__dirname, "tiers/page.tsx"), "utf8");
    const dist = readFileSync(
      join(__dirname, "distribution/page.tsx"),
      "utf8",
    );
    expect(tiers).toContain('redirect("/rewards-config")');
    expect(dist).toContain('redirect("/rewards-config")');
  });
});
