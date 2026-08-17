// Tests for the v11 Promos normalizer (MESITA-1069).
//
// This module is the SAVE-SIDE mirror of web-admin's rewards-config/promos.ts.
// The pins below are the same numbers that file's vitest suite asserts — if
// the two drift, one of the suites goes red rather than the console and the
// bill engine quietly disagreeing about what a strategy costs.

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  DEFAULT_PROMOS_V11,
  additivityError,
  identityForClassKey,
  legacyRulesFromV11,
  normalizePromosV11,
  promosWriteShape,
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

// ── the write gate ───────────────────────────────────────────────────────

Deno.test("promosWriteShape: v11 is the only accepted save shape", () => {
  assertEquals(promosWriteShape({ version: 11, visits: {}, orders: {} }), "v11");
  assertEquals(promosWriteShape(DEFAULT_PROMOS_V11), "v11");
});

Deno.test("promosWriteShape: a v10 save is a STALE TAB, never a migration", () => {
  // Reads still migrate v10 (normalizePromosV11 above proves it); a v10 WRITE
  // can only come from a bundle that predates v11, which is rendering its own
  // defaults rather than the live blob. The EF answers 409.
  assertEquals(promosWriteShape({ version: 10, base: {}, bonuses: {} }), "stale-v10");
});

Deno.test("promosWriteShape: anything else falls through to the legacy path", () => {
  for (const body of [null, undefined, [], "nope", 7, {}, { version: 9 }]) {
    assertEquals(promosWriteShape(body), "other");
  }
});

// ── the additivity guard ─────────────────────────────────────────────────

Deno.test("additivityError: the shipped grid is a legal component grid", () => {
  assertEquals(additivityError(DEFAULT_PROMOS_V11.visits.base), null);
});

Deno.test("additivityError: a cell set on its own is refused", () => {
  const base = structuredClone(DEFAULT_PROMOS_V11.visits.base);
  base.aggressive.gold.premium = 55; // the ladder resolves 60
  assert((additivityError(base) ?? "").includes("cannot be set on its own"));
});

Deno.test("additivityError: an inverted ladder is refused even with all offsets >= 0", () => {
  // Offsets from base, not rung-to-rung deltas: +15 then +5 are both
  // non-negative and still invert.
  const base = structuredClone(DEFAULT_PROMOS_V11.visits.base);
  const floor = base.conservative.bronze.free;
  base.conservative.silver.free = floor + 15;
  base.conservative.silver.premium = floor + 25;
  base.conservative.gold.free = floor + 5;
  base.conservative.gold.premium = floor + 15;
  assert((additivityError(base) ?? "").includes("invert"));
});

Deno.test("normalizePromosV11: a non-additive body is a hard error, not a silent snap", () => {
  const bad = structuredClone(DEFAULT_PROMOS_V11);
  bad.visits.base.aggressive.gold.premium = 55;
  const r = normalizePromosV11(bad);
  assertEquals(r.ok, false);
});

Deno.test("normalizePromosV11: the v10 migration still passes the guard", () => {
  // migrateV10 builds the grid from components, so it is additive by
  // construction — including when the uplift pushes a cell into the clamp.
  const migrated = normalizePromosV11({
    version: 10,
    base: {
      conservative: { standard: 10, influencer: 15, premium: 20, aura: 25 },
      aggressive: { standard: 30, influencer: 40, premium: 60, aura: 60 },
    },
    bonuses: { welcome: 10, mesita: 5, story: 10, google: 15 },
    cap: 200,
  });
  assert(migrated.ok);
  if (migrated.ok) {
    assertEquals(additivityError(migrated.value.visits.base), null);
  }
});
