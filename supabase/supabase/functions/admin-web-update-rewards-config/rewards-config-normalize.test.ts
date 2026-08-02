// Unit tests — the Rewards Config save gate (MESITA-805).
//
// This gate is LENIENT by design: it fills every missing cell from the locked
// defaults and only hard-errors on a non-object body. That is the property
// worth guarding — it is precisely what makes this page immune to the
// client↔EF key drift that broke /lineup-config for a week (MESITA-804).
// If someone ever "tightens" this into a strict gate, these tests fail and
// say why.
//
// The rate contract also lives here: 5% steps, floor 10, ceiling 50, 0 = off,
// and the Zero column is always 0. Keep in lock-step with coerceConfig in
// web-admin app/(app)/rewards-config/catalog.ts.

import { assert, assertEquals } from "jsr:@std/assert@1";
import { normalizeConfig } from "./rewards-config-normalize.ts";

const SEGMENTS = [
  "standard",
  "premium",
  "influencer",
  "aura",
  "story",
  "welcome",
  "review",
] as const;

const STRATEGIES = ["zero", "conservative", "aggressive", "dominant"] as const;

Deno.test("normalizeConfig: an empty object still yields a complete grid", () => {
  const r = normalizeConfig({});
  assert(r.ok);
  for (const seg of SEGMENTS) {
    for (const strat of STRATEGIES) {
      assertEquals(
        typeof r.value.grid[seg][strat],
        "number",
        `${seg}.${strat} missing — the gate stopped filling from defaults`,
      );
    }
  }
  assertEquals(r.value.cap, 500);
});

Deno.test("normalizeConfig: lenient — a partial blob never rejects (the anti-MESITA-804 property)", () => {
  // Every shape an out-of-date client could plausibly post.
  const partials: unknown[] = [
    {},
    { grid: {} },
    { cap: 500 },
    { grid: { standard: {} } },
    { grid: { standard: { conservative: 25 } } }, // a three-strategy client
    { grid: { standard: { zero: 0, conservative: 10, aggressive: 10 } } },
    { grid: { review: { dominant: 50 } }, cap: 300 },
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

Deno.test("normalizeConfig: the Dominant column carries its restored defaults", () => {
  const r = normalizeConfig({});
  assert(r.ok);
  const g = r.value.grid;
  // Dominant raises the FLOOR, not the ceiling — every rung a step above
  // aggressive except Review, already at the 50% platform ceiling.
  assertEquals(g.standard.dominant, 20);
  assertEquals(g.premium.dominant, 25);
  assertEquals(g.influencer.dominant, 25);
  assertEquals(g.aura.dominant, 30);
  assertEquals(g.story.dominant, 40);
  assertEquals(g.welcome.dominant, 40);
  assertEquals(g.review.dominant, 50);
  assertEquals(g.review.aggressive, 50); // the ceiling Dominant does not exceed
});

Deno.test("normalizeConfig: rates snap to the 5% grid, floor 10, ceiling 50", () => {
  const r = normalizeConfig({
    grid: {
      standard: { conservative: 13, aggressive: 999, dominant: 3 },
      review: { conservative: -5 },
    },
  });
  assert(r.ok);
  assertEquals(r.value.grid.standard.conservative, 15); // 13 → nearest 5
  assertEquals(r.value.grid.standard.aggressive, 50); // clamped to ceiling
  assertEquals(r.value.grid.standard.dominant, 10); // 3 → rounds to 5, lifted to floor
  assertEquals(r.value.grid.review.conservative, 0); // ≤ 0 means off
});

Deno.test("normalizeConfig: the Zero column is always 0, whatever is sent", () => {
  const r = normalizeConfig({
    grid: Object.fromEntries(SEGMENTS.map((s) => [s, { zero: 45 }])),
  });
  assert(r.ok);
  for (const seg of SEGMENTS) assertEquals(r.value.grid[seg].zero, 0);
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
