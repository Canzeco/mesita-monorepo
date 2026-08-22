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
import { DEFAULT_PROMOS_V11 } from "../admin-web-update-rewards-config/promos-v11-normalize.ts";

const GRID = DEFAULT_REWARDS_GRID;

Deno.test("resolveTicketRate: every dimension steps up (v9 spot-checks)", () => {
  // Strategy: same guest, same rung, two paid strategies.
  assertEquals(resolveTicketRate("conservative", GRID, { classKey: "standard", isFirstVisit: false }), 5);
  assertEquals(resolveTicketRate("aggressive", GRID, { classKey: "standard", isFirstVisit: false }), 15);
  // Class: standard < influencer < premium < aura, strictly (MESITA-877).
  assertEquals(resolveTicketRate("aggressive", GRID, { classKey: "influencer", isFirstVisit: false }), 20);
  assertEquals(resolveTicketRate("aggressive", GRID, { classKey: "premium", isFirstVisit: false }), 25);
  assertEquals(resolveTicketRate("aggressive", GRID, { classKey: "aura", isFirstVisit: false }), 30);
  assertEquals(resolveTicketRate("aggressive", GRID, { classKey: null, isFirstVisit: false }), 15);
});

Deno.test("resolveTicketRate: unknown class key falls to the Standard floor", () => {
  // A stale/unknown key (e.g. the retired 'magnetic') silently keeps the floor
  // instead of erroring — a ticket must always price.
  assertEquals(resolveTicketRate("aggressive", GRID, { classKey: "magnetic", isFirstVisit: false }), 15);
  assertEquals(resolveTicketRate("conservative", GRID, { classKey: "vip", isFirstVisit: false }), 5);
});

Deno.test("resolveTicketRate: a first visit ALONE pays only the standing rate", () => {
  // v9 (MESITA-877): Welcome is unlocked by the Google review, so arriving
  // for the first time and doing nothing is worth exactly the base bonus.
  assertEquals(resolveTicketRate("aggressive", GRID, { classKey: "standard", isFirstVisit: true }), 15);
  assertEquals(resolveTicketRate("conservative", GRID, { classKey: "premium", isFirstVisit: true }), 15);
});

Deno.test("resolveTicketRate: a VERIFIED story always pays (eligibility settled upstream)", () => {
  // The Instagram-connected gate (MESITA-909) is enforced where a story can
  // start (consumer-web-create-ticket seeding + consumer-web-submit-story
  // opt-in). Once verified, the work is done — it pays regardless of the
  // live class, so a reach lapse between the post and the check can't strip
  // an already-earned reward. The rate is read on the guest's OWN class row.
  assertEquals(
    resolveTicketRate("aggressive", GRID, { classKey: "influencer", isFirstVisit: false, storyVerified: true }),
    30,
  );
  assertEquals(
    resolveTicketRate("aggressive", GRID, { classKey: "standard", isFirstVisit: false, storyVerified: true }),
    25,
  );
  // Aura's own standing (30) loses to an earned story on the Aura row (40).
  assertEquals(
    resolveTicketRate("aggressive", GRID, { classKey: "aura", isFirstVisit: false, storyVerified: true }),
    40,
  );
  // No verified story: every class just takes its standing rung.
  assertEquals(
    resolveTicketRate("aggressive", GRID, { classKey: "aura", isFirstVisit: false }),
    30,
  );
});

Deno.test("resolveTicketRate: verified actions bump, best-of never stacks", () => {
  // First visit + Google review → the coupled Welcome rung, the top rung.
  assertEquals(
    resolveTicketRate("aggressive", GRID, { classKey: "standard", isFirstVisit: true, reviewVerified: true }),
    35,
  );
  // Story + Review + first visit for an influencer: still just the max
  // (their Welcome cell), never a sum.
  assertEquals(
    resolveTicketRate("aggressive", GRID, {
      classKey: "influencer",
      isFirstVisit: true,
      storyVerified: true,
      reviewVerified: true,
    }),
    40,
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
  // Dominant, restored 2026-08-21 on the SAME tuple it was retired with. This
  // assertion is the inverse of the D5 one it replaces: 40/50/20/30 used to be
  // coerced to Aggressive, and now resolves to the strategy it always was — so
  // any row that outlived the retirement resurrects correctly.
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
  assertEquals(g.actions.review.standard.aggressive, 30); // filled from defaults
  assertEquals(g.grid.aura.aggressive, 30); // class filled from defaults
  assertEquals(g.grid.standard.zero, 0); // off by definition
  assertEquals(g.cap, 500);
});

Deno.test("coerceRewardsGrid: v12 blob migrates by IDENTITY — flat action rows copy to every class", () => {
  // A stored v12 blob: flat story/welcome/review rows inside `grid`, no
  // `actions` block, custom review number to prove it's read (not defaults).
  const g = coerceRewardsGrid({
    cap: 500,
    grid: {
      standard: { conservative: 10, aggressive: 10 },
      review: { conservative: 33, aggressive: 44 },
      story: { conservative: 20, aggressive: 30 },
    },
  });
  // The flat legacy value lands on EVERY class of the action.
  assertEquals(g.actions.review.standard.aggressive, 44);
  assertEquals(g.actions.review.premium.aggressive, 44);
  assertEquals(g.actions.review.aura.aggressive, 44);
  assertEquals(g.actions.story.influencer.conservative, 20);
  // mesita_review didn't exist in v12, so it takes today's DEFAULTS rather
  // than a legacy value — it is priced now (MESITA-876), not 0.
  assertEquals(g.actions.mesita_review.standard.aggressive, 20);
  assertEquals(g.actions.mesita_review.aura.aggressive, 35);
});

Deno.test("resolveTicketRate: v7 per-class action rates resolve on the guest's row", () => {
  const g = coerceRewardsGrid({
    actions: {
      review: {
        standard: { conservative: 30, aggressive: 50 },
        premium: { conservative: 35, aggressive: 50 },
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
    20, // the mesita_review rung, above the 15% standing rate
  );
  // Zeroed by the operator → the flag stops changing anything.
  const unpriced = coerceRewardsGrid({
    actions: {
      mesita_review: {
        standard: { conservative: 0, aggressive: 0 },
      },
    },
  });
  assertEquals(
    resolveTicketRate("aggressive", unpriced, {
      classKey: "standard", isFirstVisit: false, mesitaReviewed: true,
    }),
    15, // back to the standing rate
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


// ── The v9 model's invariants (MESITA-877) ──────────────────────────────
//
// The matrix is three-dimensional — Reward Type × Strategy × Class — and
// STRICTLY monotonic on each axis. These tests are the model itself: a
// re-pricing that breaks one isn't a taste change, it's a broken promise to
// either the guest or the business. Ties are treated as failures because
// best-of pays exactly ONE cell, so a rung worth what the guest already had
// pays nothing for reaching it.

const STRATEGY_ORDER = ["conservative", "aggressive"] as const;
// Worst → best.
const CLASS_ORDER = ["standard", "influencer", "premium", "aura"] as const;
// Worst → best, by the business value each creates.
const TYPE_ORDER = [
  "standing",
  "mesita_review",
  "story",
  "review",
  "welcome",
] as const;

const cellOf = (
  type: (typeof TYPE_ORDER)[number],
  cls: (typeof CLASS_ORDER)[number],
  strategy: (typeof STRATEGY_ORDER)[number],
): number =>
  type === "standing"
    ? GRID.grid[cls][strategy]
    : GRID.actions[type][cls][strategy];

Deno.test("v9 defaults: reward TYPE is strictly increasing by business value", () => {
  // Base & Mesita (retention, Mesita's own data) < Story (reach) <
  // Google & Welcome (acquisition + permanent public proof).
  for (const s of STRATEGY_ORDER) {
    for (const c of CLASS_ORDER) {
      for (let i = 1; i < TYPE_ORDER.length; i++) {
        const lower = cellOf(TYPE_ORDER[i - 1], c, s);
        const higher = cellOf(TYPE_ORDER[i], c, s);
        assertEquals(
          higher > lower,
          true,
          `${s}/${c}: ${TYPE_ORDER[i]} (${higher}%) must beat ${TYPE_ORDER[i - 1]} (${lower}%)`,
        );
      }
    }
  }
});

Deno.test("v9 defaults: CLASS is strictly increasing — standard < influencer < premium < aura", () => {
  // Premium and Influencer used to TIE, which left the ladder ambiguous and
  // made the membership invisible next to a reach class.
  for (const s of STRATEGY_ORDER) {
    for (const t of TYPE_ORDER) {
      for (let i = 1; i < CLASS_ORDER.length; i++) {
        const lower = cellOf(t, CLASS_ORDER[i - 1], s);
        const higher = cellOf(t, CLASS_ORDER[i], s);
        assertEquals(
          higher > lower,
          true,
          `${s}/${t}: ${CLASS_ORDER[i]} (${higher}%) must beat ${CLASS_ORDER[i - 1]} (${lower}%)`,
        );
      }
    }
  }
});

Deno.test("v9 defaults: STRATEGY is strictly increasing, and zero pays nothing", () => {
  for (const c of CLASS_ORDER) {
    for (const t of TYPE_ORDER) {
      for (let i = 1; i < STRATEGY_ORDER.length; i++) {
        const lower = cellOf(t, c, STRATEGY_ORDER[i - 1]);
        const higher = cellOf(t, c, STRATEGY_ORDER[i]);
        assertEquals(
          higher > lower,
          true,
          `${c}/${t}: ${STRATEGY_ORDER[i]} (${higher}%) must beat ${STRATEGY_ORDER[i - 1]} (${lower}%)`,
        );
      }
    }
    // Zero is off by definition — it has no rules at all.
    assertEquals(GRID.grid[c].zero, 0);
    for (const t of TYPE_ORDER) {
      if (t !== "standing") assertEquals(GRID.actions[t][c].zero, 0);
    }
  }
});

Deno.test("v9 defaults: every cell sits on the 5% grid, inside floor and ceiling", () => {
  for (const s of STRATEGY_ORDER) {
    for (const c of CLASS_ORDER) {
      for (const t of TYPE_ORDER) {
        const cell = cellOf(t, c, s);
        assertEquals(cell % 5, 0, `${s}/${c}/${t}: ${cell}% off the 5% grid`);
        assertEquals(cell >= 5, true, `${s}/${c}/${t}: ${cell}% below the floor`);
        assertEquals(cell <= 70, true, `${s}/${c}/${t}: ${cell}% above the ceiling`);
      }
    }
  }
});

Deno.test("v9: the Welcome bonus is UNLOCKED BY the Google review, never on its own", () => {
  // A first visit with no review pays only the guest's standing rate — the
  // welcome rung is coupled, so the business gets acquisition AND a
  // permanent public review from one mechanism.
  assertEquals(
    resolveTicketRate("aggressive", GRID, { classKey: "standard", isFirstVisit: true }),
    GRID.grid.standard.aggressive,
  );
  // Review on a first visit → the welcome rung, the top of the table.
  assertEquals(
    resolveTicketRate("aggressive", GRID, {
      classKey: "standard", isFirstVisit: true, reviewVerified: true,
    }),
    GRID.actions.welcome.standard.aggressive,
  );
  // Same review on a RETURNING visit → the review rung, one step lower.
  assertEquals(
    resolveTicketRate("aggressive", GRID, {
      classKey: "standard", isFirstVisit: false, reviewVerified: true,
    }),
    GRID.actions.review.standard.aggressive,
  );
});


// ── v11 additive (MESITA-1069) ───────────────────────────────────────────
//
// The engine still receives the LEGACY `class_key` on the ticket context, so
// every case below also exercises identityForClassKey — the bridge that reads
// the (class, plan) pair back out of it until `consumers.plan` lands:
//   standard → bronze·free    influencer → silver·free
//   premium  → bronze·premium aura       → diamond·free

function withPromos(grid = DEFAULT_REWARDS_GRID) {
  return {
    ...grid,
    promos: structuredClone(DEFAULT_PROMOS_V11),
    cap: DEFAULT_PROMOS_V11.cap,
  };
}

Deno.test("resolveTicketRate: v11 additive — base alone, per legacy class", () => {
  const g = withPromos();
  assertEquals(resolveTicketRate("conservative", g, { classKey: "standard", isFirstVisit: false }), 10);
  assertEquals(resolveTicketRate("aggressive", g, { classKey: "standard", isFirstVisit: false }), 20);
  assertEquals(resolveTicketRate("aggressive", g, { classKey: "aura", isFirstVisit: false }), 50);
});

Deno.test("resolveTicketRate: v11 — the legacy `premium` class resolves as the PLAN", () => {
  const g = withPromos();
  // premium → bronze·premium: the paid subscription at the base class, which
  // is exactly what the v10 `premium` class row used to pay.
  assertEquals(resolveTicketRate("conservative", g, { classKey: "premium", isFirstVisit: false }), 20);
  assertEquals(resolveTicketRate("aggressive", g, { classKey: "premium", isFirstVisit: false }), 40);
});

Deno.test("resolveTicketRate: v11 — an unknown class prices at the floor", () => {
  const g = withPromos();
  // bronze·free, never an error and never a leak that it was unrecognised.
  assertEquals(resolveTicketRate("aggressive", g, { classKey: "wizard", isFirstVisit: false }), 20);
  assertEquals(resolveTicketRate("aggressive", g, { classKey: null, isFirstVisit: false }), 20);
});

Deno.test("resolveTicketRate: v11 additive — welcome on first visit alone (D3-A)", () => {
  const g = withPromos();
  // Welcome is NOT gated on a Google review.
  assertEquals(resolveTicketRate("aggressive", g, { classKey: "standard", isFirstVisit: true }), 30); // 20+10
  assertEquals(
    resolveTicketRate("aggressive", g, {
      classKey: "standard",
      isFirstVisit: true,
      reviewVerified: true,
    }),
    45, // 20 + welcome 10 + google 15
  );
});

Deno.test("resolveTicketRate: v11 additive — bonuses stack", () => {
  const g = withPromos();
  assertEquals(
    resolveTicketRate("aggressive", g, {
      classKey: "influencer",
      isFirstVisit: true,
      storyVerified: true,
      reviewVerified: true,
      mesitaReviewed: true,
    }),
    // influencer → silver·free base 30 + welcome 10 + story 10 + google 15
    // + mesita 5 = 70. Under v10 this cell paid 85, because the retired
    // per-class story override added 30 instead of the universal 10.
    70,
  );
});

Deno.test("resolveTicketRate: v11 additive — zero still pays nothing", () => {
  const g = withPromos();
  assertEquals(
    resolveTicketRate("zero", g, {
      classKey: "aura",
      isFirstVisit: true,
      storyVerified: true,
      reviewVerified: true,
      mesitaReviewed: true,
    }),
    0,
  );
});

Deno.test("resolveTicketRate: v11 additive — clamps at 100", () => {
  const hot = structuredClone(DEFAULT_PROMOS_V11);
  hot.visits.base.aggressive.diamond.free = 70;
  hot.visits.bonuses.aggressive = {
    welcome: 70,
    mesita: 70,
    story: 70,
    google: 70,
  };
  const g = { ...DEFAULT_REWARDS_GRID, promos: hot, cap: hot.cap };
  assertEquals(
    resolveTicketRate("aggressive", g, {
      classKey: "aura",
      isFirstVisit: true,
      storyVerified: true,
      reviewVerified: true,
      mesitaReviewed: true,
    }),
    100,
  );
});

Deno.test("offersAction: v11 reads the visits bonuses", () => {
  const g = withPromos();
  assertEquals(offersAction("aggressive", g, "story"), true);
  assertEquals(offersAction("aggressive", g, "review"), true);
  assertEquals(offersAction("zero", g, "story"), false);
});
