// Tests for the v11 Promos normalizer (MESITA-1069).
//
// This module is the SAVE-SIDE mirror of web-admin's rewards-config/promos.ts.
// The pins below are the same numbers that file's vitest suite asserts — if
// the two drift, one of the suites goes red rather than the console and the
// bill engine quietly disagreeing about what a strategy costs.

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  DEFAULT_PROMOS_V11,
  identityForClassKey,
  legacyRulesFromV11,
  normalizePromosV11,
} from "./promos-v11-normalize.ts";

function ok(raw: unknown) {
  const r = normalizePromosV11(raw);
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`);
  return r.value;
}

Deno.test("normalizePromosV11: round-trips the defaults", () => {
  assertEquals(ok(DEFAULT_PROMOS_V11), DEFAULT_PROMOS_V11);
});

Deno.test("normalizePromosV11: only a non-object is a hard error", () => {
  for (const bad of [null, undefined, [], "nope", 7]) {
    assertEquals(normalizePromosV11(bad).ok, false);
  }
});

Deno.test("normalizePromosV11: snaps to the 5% grid, drops unknown keys", () => {
  const cfg = ok({
    version: 11,
    visits: {
      base: {
        conservative: { bronze: { free: 12, bogus: 99 }, wizard: {} },
        dominant: { bronze: { free: 60 } }, // retired strategy
      },
      bonuses: { welcome: 73, mesita: -4 },
    },
    cap: 480,
    extra: true,
  });
  assertEquals(cfg.visits.base.conservative.bronze.free, 10);
  assertEquals(cfg.visits.bonuses.welcome, 70); // ceiling
  assertEquals(cfg.visits.bonuses.mesita, 0); // ≤0 → off
  assertEquals(cfg.cap, 500);
  assertEquals("extra" in cfg, false);
  assertEquals(
    Object.keys(cfg.visits.base.conservative).sort(),
    ["bronze", "diamond", "gold", "silver"],
  );
});

Deno.test("normalizePromosV11: a stored blob can never un-park orders", () => {
  const cfg = ok({ version: 11, orders: { soon: false, base: {}, bonuses: {} } });
  assertEquals(cfg.orders.soon, true);
});

// ── v10 → v11 migration ──────────────────────────────────────────────────

// The live blob at the moment of the v11 cut.
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

Deno.test("migration: splits the axes v10 conflated — premium was a PLAN", () => {
  const cfg = ok(V10);
  assertEquals(cfg.version, 11);
  assertEquals(cfg.visits.base.conservative.bronze, { free: 10, premium: 20 });
  assertEquals(cfg.visits.base.aggressive.bronze, { free: 20, premium: 40 });
  assertEquals(cfg.visits.base.conservative.silver.free, 15);
  assertEquals(cfg.visits.base.conservative.diamond.free, 25);
  assertEquals(cfg.cap, 200);
});

Deno.test("migration: carries the plan uplift across classes, interpolates gold", () => {
  const cfg = ok(V10);
  assertEquals(cfg.visits.base.conservative.silver.premium, 25); // 15 + 10
  assertEquals(cfg.visits.base.conservative.diamond.premium, 35); // 25 + 10
  assertEquals(cfg.visits.base.aggressive.diamond.premium, 70); // 50 + 20
  assertEquals(cfg.visits.base.conservative.gold.free, 20); // mid(15, 25)
  assertEquals(cfg.visits.base.aggressive.gold.free, 40); // mid(30, 50)
});

Deno.test("migration: drops the retired influencer story override", () => {
  const cfg = ok(V10);
  assertEquals(cfg.visits.bonuses, {
    welcome: 10,
    mesita: 5,
    story: 10,
    google: 10,
  });
});

Deno.test("migration: an uplifted cell clamps at the 70% ceiling", () => {
  const cfg = ok({
    ...V10,
    base: {
      ...V10.base,
      aggressive: { standard: 30, influencer: 40, premium: 60, aura: 60 },
    },
  });
  // uplift = 30, so diamond free 60 + 30 would overflow to 90.
  assertEquals(cfg.visits.base.aggressive.diamond.premium, 70);
});

Deno.test("migration: a v10-shaped body without an explicit version still migrates", () => {
  const { version: _drop, ...noVersion } = V10;
  assertEquals(ok(noVersion).visits.base.conservative.bronze.premium, 20);
});

// ── the legacy bridge ────────────────────────────────────────────────────

Deno.test("identityForClassKey: maps every live class row, floors the unknown", () => {
  assertEquals(identityForClassKey("standard"), { cls: "bronze", plan: "free" });
  assertEquals(identityForClassKey("influencer"), { cls: "silver", plan: "free" });
  assertEquals(identityForClassKey("premium"), { cls: "bronze", plan: "premium" });
  assertEquals(identityForClassKey("aura"), { cls: "diamond", plan: "free" });
  // Unknown / missing prices at the floor rather than erroring.
  assertEquals(identityForClassKey("wizard"), { cls: "bronze", plan: "free" });
  assertEquals(identityForClassKey(null), { cls: "bronze", plan: "free" });
  assertEquals(identityForClassKey(undefined), { cls: "bronze", plan: "free" });
});

Deno.test("legacyRulesFromV11: emits the complete 40-cell mirror, on-grid and ≤70", () => {
  const rules = legacyRulesFromV11(DEFAULT_PROMOS_V11);
  assertEquals(rules.length, 2 * 4 * 5); // strategies × legacy classes × actions
  for (const r of rules) {
    assert(r.discount_percent >= 0 && r.discount_percent <= 70);
    assertEquals(r.discount_percent % 5, 0);
  }
  const at = (s: string, c: string, a: string) =>
    rules.find((r) => r.strategy === s && r.class === c && r.action === a)
      ?.discount_percent;
  // The legacy `premium` row is bronze·premium — the plan, not a class.
  assertEquals(at("aggressive", "premium", "standing"), 40);
  assertEquals(at("aggressive", "premium", "welcome"), 50);
  // aura → diamond·free.
  assertEquals(at("aggressive", "aura", "welcome"), 60);
  // Every class now pays the same story bonus.
  assertEquals(at("conservative", "influencer", "story"), 25); // 15 + 10
});
