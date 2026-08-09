// Unit tests — the Promos Config v10 save gate (MESITA-991).
//
// Guards the two properties the transition depends on:
//   1. LENIENT normalize (the MESITA-804 lesson): gaps → defaults, values
//      snap, only a non-object hard-errors.
//   2. legacyRulesFromV10 emits the complete 40-cell best-of table the LIVE
//      engine reads until MESITA-992 — on-grid, ≤70, override honored.
// Keep in lock-step with promos.ts in web-admin rewards-config.

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  DEFAULT_PROMOS_V10,
  legacyRulesFromV10,
  normalizePromosV10,
} from "./promos-v10-normalize.ts";

Deno.test("round-trips the defaults", () => {
  const r = normalizePromosV10(DEFAULT_PROMOS_V10);
  assert(r.ok);
  assertEquals(r.value, DEFAULT_PROMOS_V10);
});

Deno.test("hard-errors only on a non-object body", () => {
  assert(!normalizePromosV10(null).ok);
  assert(!normalizePromosV10([1]).ok);
  assert(!normalizePromosV10("x").ok);
  assert(normalizePromosV10({}).ok);
});

Deno.test("empty object resolves to the launch defaults", () => {
  const r = normalizePromosV10({});
  assert(r.ok);
  assertEquals(r.value, DEFAULT_PROMOS_V10);
});

Deno.test("snaps rates, drops retired strategies and unknown keys", () => {
  const r = normalizePromosV10({
    base: {
      conservative: { standard: 12 },
      dominant: { standard: 60 },
    },
    bonuses: { welcome: 73, mesita: -1 },
    cap: 480,
    junk: true,
  });
  assert(r.ok);
  assertEquals(r.value.base.conservative.standard, 10);
  assertEquals(r.value.base.aggressive, DEFAULT_PROMOS_V10.base.aggressive);
  assertEquals(r.value.bonuses.welcome, 70);
  assertEquals(r.value.bonuses.mesita, 0);
  assertEquals(r.value.cap, 500);
  assert(!("junk" in r.value));
});

Deno.test("influencer override is tri-state: null inherits, absent defaults", () => {
  const withNull = normalizePromosV10({ bonuses: { story_influencer: null } });
  assert(withNull.ok);
  assertEquals(withNull.value.bonuses.story_influencer, null);

  const absent = normalizePromosV10({ bonuses: {} });
  assert(absent.ok);
  assertEquals(
    absent.value.bonuses.story_influencer,
    DEFAULT_PROMOS_V10.bonuses.story_influencer,
  );
});

Deno.test("legacyRulesFromV10 emits the complete on-grid 40-cell table", () => {
  const rules = legacyRulesFromV10(DEFAULT_PROMOS_V10);
  assertEquals(rules.length, 40);
  for (const r of rules) {
    assert(r.discount_percent >= 0 && r.discount_percent <= 70);
    assertEquals(r.discount_percent % 5, 0);
  }
  const cell = (s: string, c: string, a: string) =>
    rules.find(
      (r) => r.strategy === s && r.class === c && r.action === a,
    )?.discount_percent;
  // standing = bare base
  assertEquals(cell("aggressive", "premium", "standing"), 40);
  // influencer story honors the override (15 + 30)
  assertEquals(cell("conservative", "influencer", "story"), 45);
  // other classes take the universal story bonus (20 + 10)
  assertEquals(cell("conservative", "premium", "story"), 30);
  // welcome stacks on aura aggressive but clamps nothing here (50 + 10)
  assertEquals(cell("aggressive", "aura", "welcome"), 60);
});

Deno.test("legacy cells clamp at the 70% engine ceiling", () => {
  const r = normalizePromosV10({
    base: { aggressive: { aura: 70 } },
    bonuses: { welcome: 70 },
  });
  assert(r.ok);
  const rules = legacyRulesFromV10(r.value);
  const cell = rules.find(
    (x) =>
      x.strategy === "aggressive" && x.class === "aura" &&
      x.action === "welcome",
  );
  assertEquals(cell?.discount_percent, 70);
});
