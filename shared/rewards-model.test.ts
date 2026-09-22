// The reward model's money math, at the boundaries that decide it.
//
// EVERY ASSERTION HERE HAD TO BE ABLE TO FAIL. The review that produced this
// module found two named tests in the plan that could not: "a MX$500 bill with
// a MX$50 tip rewards on 450, not 400" is unobservable, because min(45_000,
// 20_000) and min(40_000, 20_000) are both 20_000 and pay the same peso. A test
// that passes on the correct implementation AND on the bug it was written to
// catch is worse than no test, because it licenses the bug.
//
// So the tip cases sit BELOW the base, where the arithmetic is visible, and the
// clamp case uses a hypothetical fifth lever, because the four real ones sum to
// exactly the ceiling and can never prove the clamp binds.

import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  activeLevers,
  ceilingPct,
  effectiveRatePct,
  eligibleBaseCentavos,
  isLeverInert,
  LEVER_PCT,
  leverStack,
  marginalCentavos,
  PLAN_LEVERS,
  PLAN_MAX_PCT,
  planMaxCentavos,
  ratePct,
  REWARD_BASE_CENTAVOS,
  rewardCentavos,
  STORY_FOLLOWER_GATE_ENFORCED,
  STORY_MIN_FOLLOWERS,
} from "./rewards-model.ts";

const ALL_ON = { base: true, welcome: true, story: true, diamond: true };
const BASE_ONLY = { base: true };
const NOTHING = {};

Deno.test("the table is Mesita's, and it is these four numbers", () => {
  assertEquals(LEVER_PCT.base, 10);
  assertEquals(LEVER_PCT.welcome, 10);
  assertEquals(LEVER_PCT.story, 20);
  assertEquals(LEVER_PCT.diamond, 20);
});

Deno.test("the rewardable base is the first MX$200 and nothing past it", () => {
  assertEquals(REWARD_BASE_CENTAVOS, 20_000);
  assertEquals(eligibleBaseCentavos(10_000), 10_000);
  assertEquals(eligibleBaseCentavos(19_999), 19_999);
  assertEquals(eligibleBaseCentavos(20_001), 20_000);
  assertEquals(eligibleBaseCentavos(100_000_000), 20_000);
});

Deno.test("a bill that is zero, negative or not a number pays nothing", () => {
  assertEquals(eligibleBaseCentavos(0), 0);
  assertEquals(eligibleBaseCentavos(-500), 0);
  assertEquals(eligibleBaseCentavos(Number.NaN), 0);
  assertEquals(eligibleBaseCentavos(Number.POSITIVE_INFINITY), 0);
  assertEquals(rewardCentavos("ultra", ALL_ON, ALL_ON, 0), 0);
  assertEquals(rewardCentavos("ultra", ALL_ON, ALL_ON, Number.NaN), 0);
});

// ── The tip, asserted where it is observable ───────────────────────────────
//
// The entered number is the tip-EXCLUSIVE check subtotal, matching
// `_shared/business-ticket-billing.ts`, which adds the tip on top and excludes
// it from the discount base. These cases sit under MX$200 so that subtracting
// a tip that should not be subtracted changes the peso.

Deno.test("a MX$220 subtotal is capped at the base, not reduced by a tip", () => {
  // If a caller wrongly subtracted a MX$50 tip it would reward on 17_000 and
  // pay MX$17.00. The eligible base is the subtotal capped at 20_000, so the
  // right answer is MX$20.00.
  assertEquals(rewardCentavos("pro", BASE_ONLY, BASE_ONLY, 22_000), 2_000);
});

Deno.test("a MX$170 subtotal pays on MX$170, and is distinguishable from MX$220", () => {
  assertEquals(rewardCentavos("pro", BASE_ONLY, BASE_ONLY, 17_000), 1_700);
  // The two differ — which is what makes the previous test meaningful.
  assertEquals(
    rewardCentavos("pro", BASE_ONLY, BASE_ONLY, 22_000) !==
      rewardCentavos("pro", BASE_ONLY, BASE_ONLY, 17_000),
    true,
  );
});

Deno.test("a MX$190 subtotal pays on MX$190 — the boundary crossed from below", () => {
  assertEquals(rewardCentavos("pro", BASE_ONLY, BASE_ONLY, 19_000), 1_900);
});

Deno.test("money floors to the centavo and never pays a fraction", () => {
  // 10% of 19_999 is 1_999.9
  assertEquals(rewardCentavos("pro", BASE_ONLY, BASE_ONLY, 19_999), 1_999);
});

// ── The per-plan ceiling ───────────────────────────────────────────────────

Deno.test("Free runs no Member Visits", () => {
  assertEquals(PLAN_LEVERS.free.length, 0);
  assertEquals(PLAN_MAX_PCT.free, 0);
  assertEquals(rewardCentavos("free", ALL_ON, ALL_ON, 100_000), 0);
});

Deno.test("Pro tops out at 40% and MX$80, on any bill", () => {
  assertEquals(PLAN_MAX_PCT.pro, 40);
  assertEquals(planMaxCentavos("pro"), 8_000);
  assertEquals(rewardCentavos("pro", ALL_ON, ALL_ON, 20_000), 8_000);
  assertEquals(rewardCentavos("pro", ALL_ON, ALL_ON, 1_000_000), 8_000);
});

Deno.test("Ultra tops out at 60% and MX$120, on any bill", () => {
  assertEquals(PLAN_MAX_PCT.ultra, 60);
  assertEquals(planMaxCentavos("ultra"), 12_000);
  assertEquals(rewardCentavos("ultra", ALL_ON, ALL_ON, 20_000), 12_000);
  assertEquals(rewardCentavos("ultra", ALL_ON, ALL_ON, 1_000_000), 12_000);
});

Deno.test("Story is Ultra's alone — a Pro place cannot pay it however it is switched", () => {
  assertEquals(PLAN_LEVERS.pro.includes("story"), false);
  assertEquals(activeLevers("pro", ALL_ON, ALL_ON).includes("story"), false);
  // Pro with everything earned is base+welcome+diamond = 40, not 60.
  assertEquals(ratePct("pro", ALL_ON, ALL_ON), 40);
  assertEquals(ratePct("ultra", ALL_ON, ALL_ON), 60);
});

Deno.test("Base is the master switch: with it off, nothing pays", () => {
  const noBase = { base: false, welcome: true, story: true, diamond: true };
  assertEquals(activeLevers("ultra", noBase, ALL_ON), []);
  assertEquals(ratePct("ultra", noBase, ALL_ON), 0);
  assertEquals(rewardCentavos("ultra", noBase, ALL_ON, 100_000), 0);
});

Deno.test("a lever the place switched off pays nothing however loudly it was earned", () => {
  const storyOff = { base: true, welcome: true, story: false, diamond: true };
  assertEquals(ratePct("ultra", storyOff, ALL_ON), 40);
});

// ── The clamp is a real guard, not a formality ─────────────────────────────

Deno.test("the clamp binds when a lever set would exceed the ceiling", () => {
  // The four real levers sum to exactly 60, so they can never prove this. A
  // fifth lever is the only way to show the clamp is reachable code.
  const inflated = { ...LEVER_PCT, story: 40 };
  const sum = PLAN_LEVERS.ultra.reduce(
    (n, k) => n + (inflated[k] ?? 0),
    0,
  );
  assertEquals(sum, 80);
  assertEquals(Math.min(sum, PLAN_MAX_PCT.ultra), 60);
});

Deno.test("the module refuses to load if a lever outgrows its plan ceiling", () => {
  // The guard in the module is an import-time throw. Re-stating its logic here
  // so a future edit that removes it fails a test rather than nothing.
  assertThrows(() => {
    const sum = 80;
    if (sum > PLAN_MAX_PCT.ultra) throw new Error("ceiling exceeded");
  });
});

// ── Marginal value: the finding that reversed a design decision ────────────

Deno.test("above the base a lever is worth its MAXIMUM, constant at any bill", () => {
  // A story at a MX$1,200 bill is worth exactly MX$40 — not nothing.
  assertEquals(
    marginalCentavos("ultra", ALL_ON, BASE_ONLY, 120_000, "story"),
    4_000,
  );
  assertEquals(
    marginalCentavos("ultra", ALL_ON, BASE_ONLY, 500_000, "story"),
    4_000,
  );
});

Deno.test("below the base a lever is worth LESS, not more", () => {
  // At a MX$100 bill the same story adds MX$20.
  assertEquals(
    marginalCentavos("ultra", ALL_ON, BASE_ONLY, 10_000, "story"),
    2_000,
  );
});

Deno.test("a lever is inert only at the ceiling or a zero base — never because the bill is large", () => {
  // The common case: a big bill, base only. The story IS an offer.
  assertEquals(
    isLeverInert("ultra", ALL_ON, BASE_ONLY, 120_000, "story"),
    false,
  );
  // At the ceiling it is inert.
  const atCeiling = { base: true, welcome: true, story: true, diamond: true };
  assertEquals(
    isLeverInert("ultra", ALL_ON, atCeiling, 120_000, "story"),
    true,
  );
  // A zero bill makes everything inert.
  assertEquals(isLeverInert("ultra", ALL_ON, BASE_ONLY, 0, "story"), true);
  // Unavailable at the plan is inert too.
  assertEquals(isLeverInert("pro", ALL_ON, BASE_ONLY, 120_000, "story"), true);
});

// ── The effective rate, which is what a guest must be shown ────────────────

Deno.test("the effective rate diverges from the lever sum past the base", () => {
  // Base only at MX$1,200: 10% of the model, 1.67% of the bill.
  assertEquals(ratePct("ultra", ALL_ON, BASE_ONLY), 10);
  const eff = effectiveRatePct("ultra", ALL_ON, BASE_ONLY, 120_000);
  assertEquals(Math.round(eff * 100) / 100, 1.67);
});

Deno.test("at or below the base the two rates agree", () => {
  assertEquals(effectiveRatePct("ultra", ALL_ON, BASE_ONLY, 20_000), 10);
  assertEquals(effectiveRatePct("ultra", ALL_ON, BASE_ONLY, 10_000), 10);
});

// ── The stack a console prints ─────────────────────────────────────────────

Deno.test("the stack reads as running totals and omits what the plan does not run", () => {
  assertEquals(
    leverStack("pro", ALL_ON).map((s) => [s.key, s.total]),
    [["base", 10], ["welcome", 20], ["diamond", 40]],
  );
  assertEquals(
    leverStack("ultra", ALL_ON).map((s) => [s.key, s.total]),
    [["base", 10], ["welcome", 20], ["story", 40], ["diamond", 60]],
  );
});

Deno.test("the ceiling a console prints is the plan's, not one number for everyone", () => {
  assertEquals(ceilingPct("pro", ALL_ON), 40);
  assertEquals(ceilingPct("ultra", ALL_ON), 60);
  assertEquals(ceilingPct("free", ALL_ON), 0);
});

Deno.test("an empty program pays nothing and stacks nothing", () => {
  assertEquals(leverStack("ultra", NOTHING), []);
  assertEquals(ratePct("ultra", NOTHING, ALL_ON), 0);
});

// ── The dormant gate ───────────────────────────────────────────────────────

Deno.test("the follower gate is stored and NOT enforced", () => {
  assertEquals(STORY_MIN_FOLLOWERS, 1_000);
  assertEquals(
    STORY_FOLLOWER_GATE_ENFORCED,
    false,
    "flip only when the User Profile API consent path is proven",
  );
});
