// Unit tests — Promos v5 grid-authoritative best-of resolver (MESITA-723).
// Pure, no DB. resolveTicketRate maps (strategy, grid, context) -> the single
// highest qualifying percent; everyone inherits the Standard floor; actions +
// Welcome join from context; nothing stacks. Returns ONLY the final percent
// (the blended-rate privacy invariant).

import { assertEquals } from "jsr:@std/assert@1";
import {
  coerceRewardsGrid,
  DEFAULT_REWARDS_GRID,
  isActionVerified,
  placeStrategy,
  resolveTicketRate,
} from "./rewards-config.ts";

const GRID = DEFAULT_REWARDS_GRID;

Deno.test("resolveTicketRate: class rates on a returning visit (aggressive)", () => {
  assertEquals(resolveTicketRate("aggressive", GRID, { classKey: "standard", isFirstVisit: false }), 10);
  assertEquals(resolveTicketRate("aggressive", GRID, { classKey: "premium", isFirstVisit: false }), 20);
  assertEquals(resolveTicketRate("aggressive", GRID, { classKey: "magnetic", isFirstVisit: false }), 20);
  assertEquals(resolveTicketRate("aggressive", GRID, { classKey: null, isFirstVisit: false }), 10);
});

Deno.test("resolveTicketRate: Welcome joins the set on a first visit", () => {
  assertEquals(resolveTicketRate("aggressive", GRID, { classKey: "standard", isFirstVisit: true }), 30);
  assertEquals(resolveTicketRate("conservative", GRID, { classKey: "premium", isFirstVisit: true }), 20);
});

Deno.test("resolveTicketRate: verified actions bump, best-of never stacks", () => {
  assertEquals(
    resolveTicketRate("aggressive", GRID, { classKey: "magnetic", isFirstVisit: false, storyVerified: true }),
    30,
  );
  // Review is the top rung — dominates Welcome on a first visit.
  assertEquals(
    resolveTicketRate("aggressive", GRID, { classKey: "standard", isFirstVisit: true, reviewVerified: true }),
    50,
  );
  // Both actions verified: still just the max, never a sum.
  assertEquals(
    resolveTicketRate("aggressive", GRID, {
      classKey: "premium",
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
      classKey: "premium",
      isFirstVisit: true,
      storyVerified: true,
      reviewVerified: true,
    }),
    0,
  );
});

Deno.test("placeStrategy: derives from v4 columns, dominant → aggressive", () => {
  // Conservative preset (v4 tens grid).
  assertEquals(
    placeStrategy({ welcome_free_rate: 20, welcome_premium_rate: 30, free_rate: 10, premium_rate: 20 }),
    "conservative",
  );
  // Retired Dominant preset coerces to the nearest surviving strategy.
  assertEquals(
    placeStrategy({ welcome_free_rate: 40, welcome_premium_rate: 50, free_rate: 20, premium_rate: 30 }),
    "aggressive",
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
  assertEquals(g.grid.standard.zero, 0); // off by definition
  assertEquals(g.cap, 500);
});

Deno.test("isActionVerified: verified states only", () => {
  assertEquals(isActionVerified("staff_verified"), true);
  assertEquals(isActionVerified("ai_verified"), true);
  assertEquals(isActionVerified("submitted"), false);
  assertEquals(isActionVerified("pending"), false);
  assertEquals(isActionVerified("staff_rejected"), false);
  assertEquals(isActionVerified(null), false);
});
