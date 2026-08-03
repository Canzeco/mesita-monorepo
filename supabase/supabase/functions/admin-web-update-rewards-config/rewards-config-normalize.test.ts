// Unit tests — the Rewards Config save gate (MESITA-805, v13 shape MESITA-859).
//
// This gate is LENIENT by design: it fills every missing cell from the locked
// defaults and only hard-errors on a non-object body. That is the property
// worth guarding — it is precisely what makes this page immune to the
// client↔EF key drift that broke /lineup-config for a week (MESITA-804).
// If someone ever "tightens" this into a strict gate, these tests fail and
// say why.
//
// The rate contract also lives here: 5% steps, floor 10, ceiling 50, 0 = off,
// and the Zero column is always 0. v13 adds the per-class ACTION matrix and
// the built-in v12 identity migration. Keep in lock-step with coerceConfig in
// web-admin app/(app)/rewards-config/catalog.ts.

import { assert, assertEquals } from "jsr:@std/assert@1";
import { normalizeConfig } from "./rewards-config-normalize.ts";

const CLASSES = ["standard", "premium", "influencer", "aura"] as const;
const ACTIONS = ["mesita_review", "story", "welcome", "review"] as const;
const STRATEGIES = ["zero", "conservative", "aggressive", "dominant"] as const;

Deno.test("normalizeConfig: an empty object still yields a complete matrix", () => {
  const r = normalizeConfig({});
  assert(r.ok);
  for (const cls of CLASSES) {
    for (const strat of STRATEGIES) {
      assertEquals(
        typeof r.value.grid[cls][strat],
        "number",
        `grid.${cls}.${strat} missing — the gate stopped filling from defaults`,
      );
    }
  }
  for (const action of ACTIONS) {
    for (const cls of CLASSES) {
      for (const strat of STRATEGIES) {
        assertEquals(
          typeof r.value.actions[action][cls][strat],
          "number",
          `actions.${action}.${cls}.${strat} missing`,
        );
      }
    }
  }
  assertEquals(r.value.cap, 500);
});

Deno.test("normalizeConfig: lenient — a partial blob never rejects (the anti-MESITA-804 property)", () => {
  // Every shape an out-of-date client could plausibly post — including a v12
  // client that still sends flat action rows inside `grid`.
  const partials: unknown[] = [
    {},
    { grid: {} },
    { cap: 500 },
    { grid: { standard: {} } },
    { grid: { standard: { conservative: 25 } } },
    { grid: { review: { dominant: 50 } }, cap: 300 }, // v12 flat action row
    { actions: {} },
    { actions: { review: { standard: { aggressive: 45 } } } },
    { actions: { mesita_review: {} } },
  ];
  for (const p of partials) {
    const r = normalizeConfig(p);
    assert(r.ok, `partial blob rejected: ${JSON.stringify(p)}`);
  }
});

Deno.test("normalizeConfig: output round-trips unchanged", () => {
  const first = normalizeConfig({});
  assert(first.ok);
  const second = normalizeConfig(first.value);
  assert(second.ok);
  assertEquals(second.value, first.value);
});

Deno.test("normalizeConfig: a v12 blob migrates by IDENTITY — flat action rows copy to every class", () => {
  const r = normalizeConfig({
    grid: {
      standard: { conservative: 10, aggressive: 10, dominant: 20 },
      review: { conservative: 35, aggressive: 45, dominant: 50 },
      story: { conservative: 20, aggressive: 30, dominant: 40 },
    },
  });
  assert(r.ok);
  // The flat legacy value lands on EVERY class of the action.
  for (const cls of CLASSES) {
    assertEquals(r.value.actions.review[cls].aggressive, 45);
    assertEquals(r.value.actions.story[cls].dominant, 40);
  }
  // mesita_review didn\'t exist in v12 → launches at 0 everywhere.
  for (const cls of CLASSES) {
    assertEquals(r.value.actions.mesita_review[cls].dominant, 0);
  }
});

Deno.test("normalizeConfig: per-class action cells persist independently", () => {
  const r = normalizeConfig({
    actions: {
      review: {
        standard: { aggressive: 50 },
        premium: { aggressive: 45 },
      },
    },
  });
  assert(r.ok);
  assertEquals(r.value.actions.review.standard.aggressive, 50);
  assertEquals(r.value.actions.review.premium.aggressive, 45);
  // Untouched classes fill from defaults, not from the sibling cells.
  assertEquals(r.value.actions.review.aura.aggressive, 50);
});

Deno.test("normalizeConfig: the Dominant column carries its launch defaults", () => {
  const r = normalizeConfig({});
  assert(r.ok);
  assertEquals(r.value.grid.standard.dominant, 20);
  assertEquals(r.value.grid.premium.dominant, 25);
  assertEquals(r.value.grid.influencer.dominant, 25);
  assertEquals(r.value.grid.aura.dominant, 30);
  for (const cls of CLASSES) {
    assertEquals(r.value.actions.story[cls].dominant, 40);
    assertEquals(r.value.actions.welcome[cls].dominant, 40);
    assertEquals(r.value.actions.review[cls].dominant, 50);
    assertEquals(r.value.actions.review[cls].aggressive, 50); // the ceiling
    assertEquals(r.value.actions.mesita_review[cls].dominant, 0); // unpriced
  }
});

Deno.test("normalizeConfig: rates snap to the 5% grid, floor 10, ceiling 50", () => {
  const r = normalizeConfig({
    grid: { standard: { conservative: 13, aggressive: 999, dominant: 3 } },
    actions: { review: { standard: { conservative: -5 } } },
  });
  assert(r.ok);
  assertEquals(r.value.grid.standard.conservative, 15); // 13 → nearest 5
  assertEquals(r.value.grid.standard.aggressive, 50); // clamped to ceiling
  assertEquals(r.value.grid.standard.dominant, 10); // 3 → 5, lifted to floor
  assertEquals(r.value.actions.review.standard.conservative, 0); // ≤ 0 = off
});

Deno.test("normalizeConfig: the Zero column is always 0, whatever is sent", () => {
  const r = normalizeConfig({
    grid: Object.fromEntries(CLASSES.map((c) => [c, { zero: 45 }])),
    actions: {
      review: Object.fromEntries(CLASSES.map((c) => [c, { zero: 45 }])),
    },
  });
  assert(r.ok);
  for (const cls of CLASSES) {
    assertEquals(r.value.grid[cls].zero, 0);
    assertEquals(r.value.actions.review[cls].zero, 0);
  }
});

Deno.test("normalizeConfig: cap clamps; only a non-object body hard-errors", () => {
  const hi = normalizeConfig({ cap: 999_999 });
  assert(hi.ok);
  assertEquals(hi.value.cap, 5000);

  const lo = normalizeConfig({ cap: -1 });
  assert(lo.ok);
  assertEquals(lo.value.cap, 0);

  for (const bad of [null, undefined, 42, "config", [], true]) {
    assert(!normalizeConfig(bad).ok, `${JSON.stringify(bad)} was accepted`);
  }
});
