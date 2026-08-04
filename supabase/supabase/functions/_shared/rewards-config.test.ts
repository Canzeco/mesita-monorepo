// Unit tests — Promos v6 grid-authoritative best-of resolver (MESITA-723,
// segments v6). Pure, no DB. resolveTicketRate maps (strategy, grid, context)
// -> the single highest qualifying percent; everyone inherits the Standard
// floor; class segments resolve generically; the Story rung is
// Influencer-exclusive; Welcome/Review join from context for anyone; nothing
// stacks. Returns ONLY the final percent (the blended-rate privacy invariant).

import { assertEquals } from "jsr:@std/assert@1";
import {
  coerceRewardsGrid,
  offersAction,
  DEFAULT_REWARDS_GRID,
  isActionVerified,
  isClassSegment,
  placeStrategy,
  resolveTicketRate,
} from "./rewards-config.ts";

const GRID = DEFAULT_REWARDS_GRID;

Deno.test("resolveTicketRate: dominant pays above aggressive on every rung", () => {
  // Dominant pays a step above aggressive throughout — including Review,
  // which used to tie at the old 50% ceiling and made Dominant nearly
  // indistinguishable from Aggressive despite the same price (MESITA-876).
  assertEquals(resolveTicketRate("dominant", GRID, { classKey: "standard", isFirstVisit: false }), 20);
  assertEquals(resolveTicketRate("dominant", GRID, { classKey: "aura", isFirstVisit: false }), 30);
  assertEquals(resolveTicketRate("dominant", GRID, { classKey: "standard", isFirstVisit: true }), 40);
  assertEquals(
    resolveTicketRate("dominant", GRID, { classKey: "standard", isFirstVisit: false, reviewVerified: true }),
    50,
  );
  assertEquals(
    resolveTicketRate("aggressive", GRID, { classKey: "standard", isFirstVisit: false, reviewVerified: true }),
    40,
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
  // Premium's welcome carries the +5 class step (MESITA-876), so it beats
  // both its own standing rate and a Standard guest's welcome.
  assertEquals(resolveTicketRate("conservative", GRID, { classKey: "premium", isFirstVisit: true }), 25);
});

Deno.test("resolveTicketRate: a VERIFIED story always pays (eligibility settled upstream)", () => {
  // The Influencer-only rule is enforced where a story can start
  // (business-web-create-ticket seeding + consumer-web-submit-story opt-in).
  // Once verified, the work is done and approved — it pays regardless of the
  // live class, so a reach lapse between the post and the check can't strip an
  // already-earned reward.
  assertEquals(
    resolveTicketRate("aggressive", GRID, { classKey: "influencer", isFirstVisit: false, storyVerified: true }),
    45,
  );
  // Class that later dropped below the bar keeps the earned story rung — but
  // reads it on the STANDARD row, since rates resolve on the guest's own
  // class (MESITA-876 class step).
  assertEquals(
    resolveTicketRate("aggressive", GRID, { classKey: "standard", isFirstVisit: false, storyVerified: true }),
    40,
  );
  // Aura's own rung (25) loses to an earned story (50 on the Aura row) —
  // best-of, not a sum.
  assertEquals(
    resolveTicketRate("aggressive", GRID, { classKey: "aura", isFirstVisit: false, storyVerified: true }),
    50,
  );
  // No verified story: every class just takes its own rung.
  assertEquals(
    resolveTicketRate("aggressive", GRID, { classKey: "aura", isFirstVisit: false }),
    25,
  );
});

Deno.test("resolveTicketRate: verified actions bump, best-of never stacks", () => {
  // Review beats Welcome on a first visit (40 vs 30 on the Standard row).
  assertEquals(
    resolveTicketRate("aggressive", GRID, { classKey: "standard", isFirstVisit: true, reviewVerified: true }),
    40,
  );
  // Story + Review verified for an influencer: still just the max, never a
  // sum — and Story (45) is the Influencer's top rung over Review (45 tie is
  // impossible here: story carries the +5 on a higher base).
  assertEquals(
    resolveTicketRate("aggressive", GRID, {
      classKey: "influencer",
      isFirstVisit: true,
      storyVerified: true,
      reviewVerified: true,
    }),
    45,
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

Deno.test("coerceRewardsGrid: partial blob snaps to locked defaults (v13)", () => {
  const g = coerceRewardsGrid({ grid: { standard: { conservative: 25 } } });
  assertEquals(g.grid.standard.conservative, 25);
  assertEquals(g.actions.review.standard.aggressive, 40); // filled from defaults
  assertEquals(g.grid.aura.aggressive, 25); // class filled from defaults
  assertEquals(g.grid.standard.dominant, 20); // dominant column filled
  assertEquals(g.grid.standard.zero, 0); // off by definition
  assertEquals(g.cap, 500);
});

Deno.test("coerceRewardsGrid: v12 blob migrates by IDENTITY — flat action rows copy to every class", () => {
  // A stored v12 blob: flat story/welcome/review rows inside `grid`, no
  // `actions` block, custom review number to prove it's read (not defaults).
  const g = coerceRewardsGrid({
    cap: 500,
    grid: {
      standard: { conservative: 10, aggressive: 10, dominant: 20 },
      review: { conservative: 33, aggressive: 44, dominant: 55 },
      story: { conservative: 20, aggressive: 30, dominant: 40 },
    },
  });
  // The flat legacy value lands on EVERY class of the action.
  assertEquals(g.actions.review.standard.aggressive, 44);
  assertEquals(g.actions.review.premium.aggressive, 44);
  assertEquals(g.actions.review.aura.dominant, 55);
  assertEquals(g.actions.story.influencer.conservative, 20);
  // mesita_review didn't exist in v12, so it takes today's DEFAULTS rather
  // than a legacy value — it is priced now (MESITA-876), not 0.
  assertEquals(g.actions.mesita_review.standard.dominant, 25);
  assertEquals(g.actions.mesita_review.aura.aggressive, 30);
});

Deno.test("resolveTicketRate: v7 per-class action rates resolve on the guest's row", () => {
  const g = coerceRewardsGrid({
    actions: {
      review: {
        standard: { conservative: 30, aggressive: 50, dominant: 50 },
        premium: { conservative: 35, aggressive: 50, dominant: 50 },
      },
    },
  });
  // Same verified review, different class row → different rate.
  assertEquals(
    resolveTicketRate("conservative", g, {
      classKey: "standard", isFirstVisit: false, reviewVerified: true,
    }),
    30,
  );
  assertEquals(
    resolveTicketRate("conservative", g, {
      classKey: "premium", isFirstVisit: false, reviewVerified: true,
    }),
    35,
  );
});

Deno.test("resolveTicketRate: the Mesita review rung pays only when priced", () => {
  // Priced in the defaults since MESITA-876 — a rated visit beats standing.
  assertEquals(
    resolveTicketRate("aggressive", GRID, {
      classKey: "standard", isFirstVisit: false, mesitaReviewed: true,
    }),
    20, // the mesita_review rung, above the 10% standing rate
  );
  // Zeroed by the operator → the flag stops changing anything.
  const unpriced = coerceRewardsGrid({
    actions: {
      mesita_review: {
        standard: { conservative: 0, aggressive: 0, dominant: 0 },
      },
    },
  });
  assertEquals(
    resolveTicketRate("aggressive", unpriced, {
      classKey: "standard", isFirstVisit: false, mesitaReviewed: true,
    }),
    10, // back to the standing rate
  );
});

Deno.test("offersAction: capability is ANY class > 0, per-class zeroing keeps the door open", () => {
  assertEquals(offersAction("aggressive", GRID, "review"), true);
  assertEquals(offersAction("zero", GRID, "review"), false);
  assertEquals(offersAction("aggressive", GRID, "mesita_review"), true); // priced since MESITA-876
  const partial = coerceRewardsGrid({
    actions: {
      story: {
        standard: { aggressive: 0 },
        premium: { aggressive: 0 },
        influencer: { aggressive: 30 },
        aura: { aggressive: 0 },
      },
    },
  });
  assertEquals(offersAction("aggressive", partial, "story"), true);
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

// ── The default table's invariants (MESITA-876) ─────────────────────────
//
// These four properties are WHY the defaults are the numbers they are. A
// re-pricing that breaks one isn't a taste change, it's a bug: the guest
// either stops being paid for acting, or the membership stops paying off.

const STRATEGIES = ["conservative", "aggressive", "dominant"] as const;
const CLASSES = ["standard", "premium", "influencer", "aura"] as const;
const ACTIONS = ["mesita_review", "story", "welcome", "review"] as const;

Deno.test("defaults: every action strictly beats its class's standing rate", () => {
  // A tie is a DEAD RUNG — best-of pays one cell, so an action worth the
  // same as standing pays the guest nothing for doing it. This is exactly
  // what a flat 10% Mesita Review would have been against a 10% standing.
  for (const s of STRATEGIES) {
    for (const c of CLASSES) {
      const standing = GRID.grid[c][s];
      for (const a of ACTIONS) {
        // Story is Influencer-only; its other cells never surface.
        if (a === "story" && c !== "influencer") continue;
        const rate = GRID.actions[a][c][s];
        assertEquals(
          rate > standing,
          true,
          `${s}/${c}/${a}: ${rate}% must beat standing ${standing}%`,
        );
      }
    }
  }
});

Deno.test("defaults: Premium ≥ Standard everywhere, including on actions", () => {
  // The v7 launch priced actions FLAT across classes, which made the class
  // ladder invisible to any guest who acted — Premium bought nothing at the
  // moment it was supposed to pay off.
  for (const s of STRATEGIES) {
    assertEquals(GRID.grid.premium[s] >= GRID.grid.standard[s], true, `standing ${s}`);
    for (const a of ACTIONS) {
      assertEquals(
        GRID.actions[a].premium[s] >= GRID.actions[a].standard[s],
        true,
        `${s}/${a}: premium must not trail standard`,
      );
      // Aura is the top of the class ladder on every rung.
      assertEquals(
        GRID.actions[a].aura[s] >= GRID.actions[a].premium[s],
        true,
        `${s}/${a}: aura must not trail premium`,
      );
    }
  }
});

Deno.test("defaults: each strategy pays at least the one below it", () => {
  for (const c of CLASSES) {
    assertEquals(GRID.grid[c].aggressive >= GRID.grid[c].conservative, true);
    assertEquals(GRID.grid[c].dominant >= GRID.grid[c].aggressive, true);
    for (const a of ACTIONS) {
      assertEquals(
        GRID.actions[a][c].aggressive >= GRID.actions[a][c].conservative,
        true,
        `${c}/${a}: aggressive must not trail conservative`,
      );
      assertEquals(
        GRID.actions[a][c].dominant >= GRID.actions[a][c].aggressive,
        true,
        `${c}/${a}: dominant must not trail aggressive`,
      );
    }
  }
});

Deno.test("defaults: Story is the Influencer's best rung, and nothing exceeds the 70% ceiling", () => {
  for (const s of STRATEGIES) {
    const story = GRID.actions.story.influencer[s];
    for (const a of ACTIONS) {
      assertEquals(
        story >= GRID.actions[a].influencer[s],
        true,
        `${s}: story (${story}%) must be the influencer's top rung`,
      );
    }
  }
  // Every cell stays on the 5% grid and inside the ceiling (MESITA-866/872).
  for (const s of STRATEGIES) {
    for (const c of CLASSES) {
      for (const cell of [GRID.grid[c][s], ...ACTIONS.map((a) => GRID.actions[a][c][s])]) {
        assertEquals(cell % 5, 0, `${s}/${c}: ${cell}% must sit on the 5% grid`);
        assertEquals(cell <= 70, true, `${s}/${c}: ${cell}% exceeds the ceiling`);
      }
    }
  }
});
