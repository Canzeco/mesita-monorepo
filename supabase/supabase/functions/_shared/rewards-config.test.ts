// Unit tests — Promos v6 grid-authoritative best-of resolver (MESITA-723,
// segments v6). Pure, no DB. resolveTicketRate maps (strategy, grid, context)
// -> the single highest qualifying percent; everyone inherits the Standard
// floor; class segments resolve generically; the Story rung is
// Influencer-exclusive; Welcome/Review join from context for anyone; nothing
// stacks. Returns ONLY the final percent (the blended-rate privacy invariant).

import { assertEquals } from "jsr:@std/assert@1";
import {
  coerceRewardsGrid,
  DEFAULT_REWARDS_GRID,
  isActionVerified,
  isClassSegment,
  placeStrategy,
  resolveTicketRate,
} from "./rewards-config.ts";

const GRID = DEFAULT_REWARDS_GRID;

Deno.test("resolveTicketRate: dominant raises the floor, never the ceiling", () => {
  // Dominant pays a step above aggressive on every rung...
  assertEquals(resolveTicketRate("dominant", GRID, { classKey: "standard", isFirstVisit: false }), 20);
  assertEquals(resolveTicketRate("dominant", GRID, { classKey: "aura", isFirstVisit: false }), 30);
  assertEquals(resolveTicketRate("dominant", GRID, { classKey: "standard", isFirstVisit: true }), 40);
  // ...except Review, already at the 50% platform ceiling under aggressive.
  assertEquals(
    resolveTicketRate("dominant", GRID, { classKey: "standard", isFirstVisit: false, reviewVerified: true }),
    50,
  );
  assertEquals(
    resolveTicketRate("aggressive", GRID, { classKey: "standard", isFirstVisit: false, reviewVerified: true }),
    50,
  );
});

Deno.test("resolveTicketRate: class rates on a returning visit (aggressive)", () => {
  assertEquals(resolveTicketRate("aggressive", GRID, { classKey: "standard", isFirstVisit: false }), 10);
  assertEquals(resolveTicketRate("aggressive", GRID, { classKey: "premium", isFirstVisit: false }), 20);
  assertEquals(resolveTicketRate("aggressive", GRID, { classKey: "influencer", isFirstVisit: false }), 20);
  assertEquals(resolveTicketRate("aggressive", GRID, { classKey: "aura", isFirstVisit: false }), 25);
  assertEquals(resolveTicketRate("aggressive", GRID, { classKey: null, isFirstVisit: false }), 10);
});

Deno.test("resolveTicketRate: unknown class key falls to the Standard floor", () => {
  // A stale/unknown key (e.g. the retired 'magnetic') silently keeps the floor
  // instead of erroring — a ticket must always price.
  assertEquals(resolveTicketRate("aggressive", GRID, { classKey: "magnetic", isFirstVisit: false }), 10);
  assertEquals(resolveTicketRate("conservative", GRID, { classKey: "vip", isFirstVisit: false }), 10);
});

Deno.test("resolveTicketRate: Welcome joins the set on a first visit", () => {
  assertEquals(resolveTicketRate("aggressive", GRID, { classKey: "standard", isFirstVisit: true }), 30);
  assertEquals(resolveTicketRate("conservative", GRID, { classKey: "premium", isFirstVisit: true }), 20);
});

Deno.test("resolveTicketRate: a VERIFIED story always pays (eligibility settled upstream)", () => {
  // The Influencer-only rule is enforced where a story can start
  // (business-web-create-ticket seeding + consumer-web-submit-story opt-in).
  // Once verified, the work is done and approved — it pays regardless of the
  // live class, so a reach lapse between the post and the check can't strip an
  // already-earned reward.
  assertEquals(
    resolveTicketRate("aggressive", GRID, { classKey: "influencer", isFirstVisit: false, storyVerified: true }),
    30,
  );
  // Class that later dropped below the bar keeps the earned story rung.
  assertEquals(
    resolveTicketRate("aggressive", GRID, { classKey: "standard", isFirstVisit: false, storyVerified: true }),
    30,
  );
  // Aura's own rung (25) loses to an earned story (30) — best-of, not a sum.
  assertEquals(
    resolveTicketRate("aggressive", GRID, { classKey: "aura", isFirstVisit: false, storyVerified: true }),
    30,
  );
  // No verified story: every class just takes its own rung.
  assertEquals(
    resolveTicketRate("aggressive", GRID, { classKey: "aura", isFirstVisit: false }),
    25,
  );
});

Deno.test("resolveTicketRate: verified actions bump, best-of never stacks", () => {
  // Review is the top rung — dominates Welcome on a first visit.
  assertEquals(
    resolveTicketRate("aggressive", GRID, { classKey: "standard", isFirstVisit: true, reviewVerified: true }),
    50,
  );
  // Story + Review verified for an influencer: still just the max, never a sum.
  assertEquals(
    resolveTicketRate("aggressive", GRID, {
      classKey: "influencer",
      isFirstVisit: true,
      storyVerified: true,
      reviewVerified: true,
    }),
    50,
  );
});

Deno.test("resolveTicketRate: zero strategy pays nothing", () => {
  assertEquals(
    resolveTicketRate("zero", GRID, {
      classKey: "aura",
      isFirstVisit: true,
      storyVerified: true,
      reviewVerified: true,
    }),
    0,
  );
});

Deno.test("isClassSegment: the four classes and nothing else", () => {
  assertEquals(isClassSegment("standard"), true);
  assertEquals(isClassSegment("premium"), true);
  assertEquals(isClassSegment("influencer"), true);
  assertEquals(isClassSegment("aura"), true);
  assertEquals(isClassSegment("magnetic"), false); // retired
  assertEquals(isClassSegment("story"), false); // action, not class
  assertEquals(isClassSegment(null), false);
  assertEquals(isClassSegment(undefined), false);
});

Deno.test("placeStrategy: derives from v4 columns, all four strategies", () => {
  // Conservative preset (v4 tens grid).
  assertEquals(
    placeStrategy({ welcome_free_rate: 20, welcome_premium_rate: 30, free_rate: 10, premium_rate: 20 }),
    "conservative",
  );
  // Aggressive preset.
  assertEquals(
    placeStrategy({ welcome_free_rate: 30, welcome_premium_rate: 50, free_rate: 10, premium_rate: 30 }),
    "aggressive",
  );
  // Dominant preset — restored in v6.1; no longer coerced to aggressive.
  assertEquals(
    placeStrategy({ welcome_free_rate: 40, welcome_premium_rate: 50, free_rate: 20, premium_rate: 30 }),
    "dominant",
  );
  // Custom / all-null → zero.
  assertEquals(
    placeStrategy({ welcome_free_rate: null, welcome_premium_rate: null, free_rate: null, premium_rate: null }),
    "zero",
  );
});

Deno.test("coerceRewardsGrid: partial blob snaps to locked defaults", () => {
  const g = coerceRewardsGrid({ grid: { standard: { conservative: 25 } } });
  assertEquals(g.grid.standard.conservative, 25);
  assertEquals(g.grid.review.aggressive, 50); // filled from defaults
  assertEquals(g.grid.aura.aggressive, 25); // new segment filled from defaults
  assertEquals(g.grid.standard.dominant, 20); // dominant column filled from defaults
  assertEquals(g.grid.standard.zero, 0); // off by definition
  assertEquals(g.cap, 500);
});

Deno.test("isActionVerified: verified states only", () => {
  // v3 (MESITA-849): the guest's own declaration is a verification.
  assertEquals(isActionVerified("self_verified"), true);
  assertEquals(isActionVerified("staff_verified"), true);
  assertEquals(isActionVerified("ai_verified"), true);
  assertEquals(isActionVerified("submitted"), false);
  assertEquals(isActionVerified("pending"), false);
  assertEquals(isActionVerified("staff_rejected"), false);
  assertEquals(isActionVerified(null), false);
});
