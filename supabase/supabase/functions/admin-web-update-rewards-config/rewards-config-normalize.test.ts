// Unit tests — the Rewards Config save gate (MESITA-805, v8 rules MESITA-873).
//
// This gate is LENIENT by design: it fills every missing rule from the locked
// defaults, drops unknown keys, and only hard-errors on a non-object body.
// That is the property worth guarding — it is precisely what makes this page
// immune to the client↔EF key drift that broke /lineup-config for a week
// (MESITA-804). If someone ever "tightens" this into a strict gate, these
// tests fail and say why.
//
// The contract also lives here: the payload is a FLAT rule list, one per
// (strategy × class × action) with "standing" as the None column; rates snap
// to the 5% grid, floor 5, ceiling 70, 0 = off; the cap is categorical.
// Keep in lock-step with coerceRules in web-admin
// app/(app)/rewards-config/catalog.ts.

import { assert, assertEquals } from "jsr:@std/assert@1";
import { normalizeRewards } from "./rewards-config-normalize.ts";

const CLASSES = ["standard", "premium", "influencer", "aura"] as const;
const ACTIONS = [
  "standing",
  "mesita_review",
  "story",
  "welcome",
  "review",
] as const;
const STRATEGIES = ["conservative", "aggressive", "dominant"] as const;

const RULE_COUNT = STRATEGIES.length * CLASSES.length * ACTIONS.length; // 60

function rateOf(
  rules: { strategy: string; class: string; action: string; discount_percent: number }[],
  strategy: string,
  cls: string,
  action: string,
): number {
  const hit = rules.find(
    (r) => r.strategy === strategy && r.class === cls && r.action === action,
  );
  assert(hit, `missing rule ${strategy}/${cls}/${action}`);
  return hit.discount_percent;
}

Deno.test("normalizeRewards: an empty object still yields all 60 rules", () => {
  const r = normalizeRewards({});
  assert(r.ok);
  assertEquals(r.value.rules.length, RULE_COUNT);
  // Every combination present exactly once.
  const keys = new Set(
    r.value.rules.map((x) => `${x.strategy}|${x.class}|${x.action}`),
  );
  assertEquals(keys.size, RULE_COUNT);
  // Launch defaults survive: standing varies by class, review does not.
  assertEquals(rateOf(r.value.rules, "conservative", "standard", "standing"), 10);
  assertEquals(rateOf(r.value.rules, "conservative", "aura", "standing"), 20);
  assertEquals(rateOf(r.value.rules, "aggressive", "premium", "review"), 50);
  // Mesita Review launched unpriced.
  for (const cls of CLASSES) {
    assertEquals(rateOf(r.value.rules, "dominant", cls, "mesita_review"), 0);
  }
});

Deno.test("normalizeRewards: zero strategy never gets rows — it is off by definition", () => {
  const r = normalizeRewards({
    rules: [
      { strategy: "zero", class: "standard", action: "standing", discount_percent: 45 },
    ],
  });
  assert(r.ok);
  assertEquals(r.value.rules.length, RULE_COUNT);
  // Cast: the return TYPE already excludes "zero"; this guards the runtime.
  assertEquals(
    r.value.rules.some((x) => (x.strategy as string) === "zero"),
    false,
  );
});

Deno.test("normalizeRewards: a sent rule wins; the rest keep their defaults", () => {
  const r = normalizeRewards({
    rules: [
      { strategy: "conservative", class: "premium", action: "review", discount_percent: 35 },
    ],
  });
  assert(r.ok);
  assertEquals(rateOf(r.value.rules, "conservative", "premium", "review"), 35);
  // Its siblings are untouched — per-class cells are independent.
  assertEquals(rateOf(r.value.rules, "conservative", "standard", "review"), 30);
  assertEquals(rateOf(r.value.rules, "conservative", "aura", "review"), 30);
});

Deno.test("normalizeRewards: rates snap to the 5% grid, floor 5, ceiling 70", () => {
  const r = normalizeRewards({
    rules: [
      { strategy: "aggressive", class: "standard", action: "standing", discount_percent: 13 },
      { strategy: "aggressive", class: "premium", action: "standing", discount_percent: 999 },
      { strategy: "aggressive", class: "influencer", action: "standing", discount_percent: 3 },
      { strategy: "aggressive", class: "aura", action: "standing", discount_percent: -5 },
      { strategy: "dominant", class: "standard", action: "story", discount_percent: 70 },
    ],
  });
  assert(r.ok);
  assertEquals(rateOf(r.value.rules, "aggressive", "standard", "standing"), 15); // 13 → nearest 5
  assertEquals(rateOf(r.value.rules, "aggressive", "premium", "standing"), 70); // ceiling (MESITA-872)
  assertEquals(rateOf(r.value.rules, "aggressive", "influencer", "standing"), 5); // floor (MESITA-866)
  assertEquals(rateOf(r.value.rules, "aggressive", "aura", "standing"), 0); // ≤ 0 = off
  assertEquals(rateOf(r.value.rules, "dominant", "standard", "story"), 70); // 70 survives
});

Deno.test("normalizeRewards: unknown keys are dropped, not written", () => {
  const r = normalizeRewards({
    rules: [
      { strategy: "conservative", class: "vip", action: "standing", discount_percent: 50 },
      { strategy: "conservative", class: "standard", action: "tiktok", discount_percent: 50 },
      { strategy: "reckless", class: "standard", action: "standing", discount_percent: 50 },
      "not an object",
      null,
    ],
  });
  assert(r.ok);
  assertEquals(r.value.rules.length, RULE_COUNT);
  assertEquals(r.value.rules.some((x) => (x.class as string) === "vip"), false);
  assertEquals(
    r.value.rules.some((x) => (x.action as string) === "tiktok"),
    false,
  );
  // The real cell it tried to overwrite kept its default.
  assertEquals(rateOf(r.value.rules, "conservative", "standard", "standing"), 10);
});

Deno.test("normalizeRewards: cap snaps to the nearest allowed option", () => {
  // Categorical cap: {100, 200, 500, 1000}. A cap of 0 ("no ceiling") can no
  // longer be written, and an off-ladder value lands on its nearest neighbour.
  const cases: [unknown, number][] = [
    [100, 100],
    [200, 200],
    [500, 500],
    [1000, 1000],
    [237, 200],
    [400, 500],
    [999_999, 1000],
    [-1, 100],
    [0, 100],
    ["500", 500], // non-numeric → default
    [undefined, 500],
  ];
  for (const [input, want] of cases) {
    const r = normalizeRewards({ cap: input });
    assert(r.ok);
    assertEquals(r.value.cap, want, `cap ${JSON.stringify(input)}`);
  }
});

Deno.test("normalizeRewards: only a non-object body hard-errors", () => {
  for (const bad of [null, undefined, 42, "payload", [], true]) {
    assert(!normalizeRewards(bad).ok, `${JSON.stringify(bad)} was accepted`);
  }
});
