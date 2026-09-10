// Tests for the v12 Promos normalizer (MESITA-1705).
//
// This module is the SAVE-SIDE mirror of web-admin's rewards-config/promos.ts.
// The pins below are the same numbers that file's vitest suite asserts — if
// the two drift, one of the suites goes red rather than the console and the
// bill engine quietly disagreeing about what a strategy costs.
//
// v12 deleted the PLAN axis. The migration tests are the important ones here:
// a live blob is v11 on the day this deploys, so every bill is priced by
// migrateV11 until the operator saves once.

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  DEFAULT_PROMOS_V12,
  additivityError,
  identityForClassKey,
  legacyRulesFromV12,
  normalizePromos,
  promosWriteShape,
} from "./promos-normalize.ts";

function ok(raw: unknown) {
  const r = normalizePromos(raw);
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`);
  return r.value;
}

Deno.test("normalizePromos: round-trips the defaults", () => {
  assertEquals(ok(DEFAULT_PROMOS_V12), DEFAULT_PROMOS_V12);
});

Deno.test("normalizePromos: only a non-object is a hard error", () => {
  for (const bad of [null, undefined, [], "nope", 7]) {
    assertEquals(normalizePromos(bad).ok, false);
  }
});

Deno.test("normalizePromos: snaps to the 5% grid, drops unknown keys", () => {
  const cfg = ok({
    version: 12,
    visits: {
      base: { conservative: { bronze: 12, wizard: 99 } },
      bonuses: { welcome: 73, mesita: -4 },
    },
    cap: 480,
    extra: true,
  });
  assertEquals(cfg.visits.base.conservative.bronze, 10);
  // A FLAT bonus body fans out to every strategy (the legacy shape).
  assertEquals(cfg.visits.bonuses.conservative.welcome, 70); // ceiling
  assertEquals(cfg.visits.bonuses.conservative.mesita, 0); // ≤0 → off
  assertEquals(cfg.visits.bonuses.aggressive.welcome, 70);
  assertEquals(cfg.cap, 500);
  assertEquals("extra" in cfg, false);
  assertEquals(
    Object.keys(cfg.visits.base.conservative).sort(),
    ["bronze", "diamond", "gold", "silver"],
  );
});

Deno.test("normalizePromos: a class row is a NUMBER, never a plan object", () => {
  const cfg = ok(DEFAULT_PROMOS_V12);
  for (const s of ["conservative", "aggressive", "dominant"] as const) {
    for (const c of ["bronze", "silver", "gold", "diamond"] as const) {
      assertEquals(typeof cfg.visits.base[s][c], "number");
    }
    assertEquals(typeof cfg.orders.base[s], "number");
  }
});

Deno.test("normalizePromos: a stored blob can never un-park orders", () => {
  const cfg = ok({ version: 12, orders: { soon: false, base: {}, bonuses: {} } });
  assertEquals(cfg.orders.soon, true);
});

// ── v11 → v12 migration ──────────────────────────────────────────────────

const V11_BLOB = {
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

Deno.test("normalizePromos: a v11 blob keeps its FREE column and drops premium", () => {
  const cfg = ok(V11_BLOB);
  assertEquals(cfg.version, 12);
  assertEquals(cfg.visits.base.conservative, {
    bronze: 10,
    silver: 15,
    gold: 20,
    diamond: 25,
  });
  assertEquals(cfg.visits.base.aggressive.diamond, 50); // was 50 free / 70 premium
  assertEquals(cfg.orders.base, { conservative: 5, aggressive: 10, dominant: 15 });
});

Deno.test("normalizePromos: the LIVE v11 defaults migrate to the v12 defaults", () => {
  // The bill a place pays must not move on the day this deploys. The blob in
  // app_config is v11 until the operator's first save, so this equality IS the
  // no-money-moves guarantee.
  assertEquals(ok(V11_BLOB), DEFAULT_PROMOS_V12);
});

Deno.test("normalizePromos: a v11 blob is detected without its version tag", () => {
  // A hand-edited app_config row can lose `version`; the plan level in the
  // class rows is what actually identifies the shape.
  const untagged = structuredClone(V11_BLOB) as Record<string, unknown>;
  delete untagged.version;
  assertEquals(ok(untagged).visits.base.conservative.silver, 15);
});

Deno.test("normalizePromos: a v11 migration keeps operator tuning on the free column", () => {
  const tuned = structuredClone(V11_BLOB);
  tuned.visits.base.conservative.bronze.free = 25;
  tuned.visits.base.conservative.silver.free = 30;
  tuned.visits.base.conservative.gold.free = 35;
  tuned.visits.base.conservative.diamond.free = 40;
  const cfg = ok(tuned);
  assertEquals(cfg.visits.base.conservative, {
    bronze: 25,
    silver: 30,
    gold: 35,
    diamond: 40,
  });
});

// ── v10 → v12 migration ──────────────────────────────────────────────────

Deno.test("normalizePromos: a v10 blob drops the `premium` row entirely", () => {
  // `premium` was the subscription wearing a class costume. v12 does not price
  // the plan, so the row is dropped rather than folded in as an uplift.
  const cfg = ok({
    version: 10,
    base: {
      conservative: { standard: 10, influencer: 15, premium: 20, aura: 25 },
    },
    bonuses: { welcome: 10, mesita: 5, story: 10, google: 15 },
    cap: 500,
  });
  assertEquals(cfg.version, 12);
  assertEquals(cfg.visits.base.conservative.bronze, 10); // standard
  assertEquals(cfg.visits.base.conservative.silver, 15); // influencer
  assertEquals(cfg.visits.base.conservative.diamond, 25); // aura
  assertEquals(cfg.visits.base.conservative.gold, 20); // mid(15, 25)
});

// ── identity ─────────────────────────────────────────────────────────────

Deno.test("identityForClassKey: maps every live class row, floors the unknown", () => {
  assertEquals(identityForClassKey("bronze"), { cls: "bronze" });
  assertEquals(identityForClassKey("silver"), { cls: "silver" });
  assertEquals(identityForClassKey("gold"), { cls: "gold" });
  assertEquals(identityForClassKey("diamond"), { cls: "diamond" });
  assertEquals(identityForClassKey("standard"), { cls: "bronze" });
  assertEquals(identityForClassKey("influencer"), { cls: "silver" });
  assertEquals(identityForClassKey("aura"), { cls: "diamond" });
  // The legacy `premium` key was bronze under the subscription costume. With
  // the plan axis gone it is plain bronze — a rate CUT for such a row, and
  // deliberate: the probe found zero of them at the cutover.
  assertEquals(identityForClassKey("premium"), { cls: "bronze" });

  assertEquals(identityForClassKey("wizard"), { cls: "bronze" });
  assertEquals(identityForClassKey(null), { cls: "bronze" });
  assertEquals(identityForClassKey(undefined), { cls: "bronze" });
});

Deno.test("legacyRulesFromV12: emits the complete mirror, on-grid and ≤70", () => {
  const rules = legacyRulesFromV12(DEFAULT_PROMOS_V12);
  assertEquals(rules.length, 3 * 4 * 5); // strategies × legacy classes × actions
  for (const r of rules) {
    assert(r.discount_percent >= 0 && r.discount_percent <= 70);
    assertEquals(r.discount_percent % 5, 0);
  }
  const at = (s: string, c: string, a: string) =>
    rules.find((r) => r.strategy === s && r.class === c && r.action === a)
      ?.discount_percent;
  // The legacy `premium` row is plain bronze now — same as `standard`.
  assertEquals(at("aggressive", "premium", "standing"), 20);
  assertEquals(at("aggressive", "premium", "standing"), at("aggressive", "standard", "standing"));
  assertEquals(at("aggressive", "premium", "welcome"), 30);
  // aura → diamond.
  assertEquals(at("aggressive", "aura", "welcome"), 60);
  // Every class pays the same story bonus.
  assertEquals(at("conservative", "influencer", "story"), 25); // 15 + 10
});

// ── the write gate ───────────────────────────────────────────────────────

Deno.test("promosWriteShape: v12 is the only accepted save shape", () => {
  assertEquals(promosWriteShape({ version: 12, visits: {}, orders: {} }), "v12");
  assertEquals(promosWriteShape(DEFAULT_PROMOS_V12), "v12");
});

Deno.test("promosWriteShape: a v11 save is a STALE TAB, never a migration", () => {
  // This is the guard that stops the plan axis coming back. Reads migrate v11
  // (proven above); a v11 WRITE can only come from a bundle that predates v12,
  // which is rendering its own defaults — and those defaults still carry the
  // plan grid. Accepting it would overwrite every live rate AND reinstate the
  // axis this version removed. The EF answers 409.
  assertEquals(promosWriteShape(V11_BLOB), "stale-v11");
  assertEquals(promosWriteShape({ version: 11 }), "stale-v11");
});

Deno.test("promosWriteShape: a v10 save is a STALE TAB too", () => {
  assertEquals(promosWriteShape({ version: 10, base: {}, bonuses: {} }), "stale-v10");
});

Deno.test("promosWriteShape: anything else falls through to the legacy path", () => {
  for (const body of [null, undefined, [], "nope", 7, {}, { version: 9 }]) {
    assertEquals(promosWriteShape(body), "other");
  }
});

// ── the additivity guard ─────────────────────────────────────────────────

Deno.test("additivityError: the shipped grid is a legal component grid", () => {
  assertEquals(additivityError(DEFAULT_PROMOS_V12.visits.base), null);
});

Deno.test("additivityError: a single-axis grid is always expressible as components", () => {
  // v11 also refused a cell that did not equal base + class + plan. That check
  // cannot fail once plan is gone — the class offset is derived from the cell,
  // so any on-grid value round-trips — and it was deleted rather than left as
  // a test that always passes. Pinned here so a future reader does not
  // "restore" it.
  const base = structuredClone(DEFAULT_PROMOS_V12.visits.base);
  base.aggressive.gold = 45; // still climbing: 20 / 30 / 45 / 50
  assertEquals(additivityError(base), null);
});

Deno.test("additivityError: an inverted ladder is refused even with all offsets >= 0", () => {
  // Offsets from base, not rung-to-rung deltas: +15 then +5 are both
  // non-negative and still invert.
  const base = structuredClone(DEFAULT_PROMOS_V12.visits.base);
  const floor = base.conservative.bronze;
  base.conservative.silver = floor + 15;
  base.conservative.gold = floor + 5;
  assert((additivityError(base) ?? "").includes("invert"));
});

Deno.test("normalizePromos: an inverted body is a hard error, not a silent snap", () => {
  const bad = structuredClone(DEFAULT_PROMOS_V12);
  bad.visits.base.aggressive.gold = 25; // below silver's 30
  assertEquals(normalizePromos(bad).ok, false);
});

Deno.test("normalizePromos: both migrations still pass the guard", () => {
  // The migrations build the grid from components, so they are additive by
  // construction — including when a clamp bites.
  const fromV10 = normalizePromos({
    version: 10,
    base: {
      conservative: { standard: 10, influencer: 15, premium: 20, aura: 25 },
      aggressive: { standard: 30, influencer: 40, premium: 60, aura: 60 },
    },
    bonuses: { welcome: 10, mesita: 5, story: 10, google: 15 },
    cap: 200,
  });
  assert(fromV10.ok);
  if (fromV10.ok) assertEquals(additivityError(fromV10.value.visits.base), null);

  const fromV11 = normalizePromos(V11_BLOB);
  assert(fromV11.ok);
  if (fromV11.ok) assertEquals(additivityError(fromV11.value.visits.base), null);
});
