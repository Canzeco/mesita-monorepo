import { describe, expect, it } from "vitest";
import { STRATEGIES, strategyForPlace } from "@/lib/business/strategies";
import {
  effectiveStrikeCount,
  isCardCurrent,
  lifecycleView,
  STRIKE_DECAY_DAYS,
} from "./promo-state";

/** Strike decay window — re-exported from promo-state for assertions. */
const DAY_MS = 86_400_000;
const NOW = Date.parse("2026-08-07T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * DAY_MS).toISOString();

describe("isCardCurrent — the F1 gate", () => {
  it("unsubscribed: NEVER current, Zero included (join-onto-Zero stays open)", () => {
    for (const cardId of ["zero", "conservative", "aggressive"] as const) {
      // A fresh place has all-null rates → strategyForPlace seeds
      // selectedId with "zero"; the gate must ignore it.
      expect(isCardCurrent(false, "zero", cardId)).toBe(false);
    }
  });

  it("subscribed member on Zero (null rates): Zero is honestly Current", () => {
    expect(isCardCurrent(true, "zero", "zero")).toBe(true);
    expect(isCardCurrent(true, "zero", "conservative")).toBe(false);
  });

  it("subscribed with custom rates (null selection): nothing current", () => {
    expect(isCardCurrent(true, null, "conservative")).toBe(false);
  });
});

describe("effectiveStrikeCount (mirrors EF lazy decay)", () => {
  it("returns 0 for no strikes", () => {
    expect(effectiveStrikeCount({}, NOW)).toBe(0);
    expect(effectiveStrikeCount({ strike_count: 0 }, NOW)).toBe(0);
  });

  it("keeps fresh strikes", () => {
    expect(
      effectiveStrikeCount(
        { strike_count: 2, last_strike_at: daysAgo(100) },
        NOW,
      ),
    ).toBe(2);
  });

  it("all-or-nothing decay at the boundary", () => {
    expect(
      effectiveStrikeCount(
        { strike_count: 2, last_strike_at: daysAgo(STRIKE_DECAY_DAYS - 1) },
        NOW,
      ),
    ).toBe(2);
    expect(
      effectiveStrikeCount(
        { strike_count: 2, last_strike_at: daysAgo(STRIKE_DECAY_DAYS) },
        NOW,
      ),
    ).toBe(0);
  });

  it("trusts the raw count when last_strike_at is missing", () => {
    expect(effectiveStrikeCount({ strike_count: 1 }, NOW)).toBe(1);
  });
});

describe("strategyForPlace contract (locks the documented trap)", () => {
  it("all-null rates match Zero — the reason the gate exists", () => {
    expect(
      strategyForPlace({
        welcome_free_rate: null,
        welcome_premium_rate: null,
        free_rate: null,
        premium_rate: null,
      }),
    ).toBe("zero");
  });

  it("every preset's own rates round-trip to its id", () => {
    for (const s of STRATEGIES) {
      expect(strategyForPlace(s.rates)).toBe(s.id);
    }
  });

  it("off-preset rates match null (custom state)", () => {
    const paid = STRATEGIES.find((s) => s.id !== "zero")!;
    // 33 is outside the legal 10..50-by-10 set, so no preset can carry it.
    expect(strategyForPlace({ ...paid.rates, premium_rate: 33 })).toBe(null);
  });

  // The inverse of the MESITA-993 trap. Dominant was restored 2026-08-21 on
  // the SAME tuple it was retired with, so these rows resolve to the strategy
  // they always ran. Critically, this console WRITES what it resolves — had
  // the coercion stayed, a Dominant place would have been downgraded to
  // Aggressive rates by its own next save.
  it("Dominant rates (40/50/20/30) resolve to Dominant, not Aggressive", () => {
    expect(
      strategyForPlace({
        welcome_free_rate: 40,
        welcome_premium_rate: 50,
        free_rate: 20,
        premium_rate: 30,
      }),
    ).toBe("dominant");
  });
});

describe("lifecycleView — the Box 0 stepper state machine", () => {
  it("not_member: step 1 current, rest upcoming (Zero match ignored via gate)", () => {
    expect(lifecycleView({ plan: "free" }, "zero", NOW)).toEqual({
      kind: "rail",
      join: "current",
      strategy: "upcoming",
      honor: "upcoming",
    });
  });

  it("ghost-partner hold blocks honoring, outranking live/pause/forfeit (MESITA-1311)", () => {
    expect(
      lifecycleView(
        {
          plan: "pro",
          plan_live_at: "2026-08-01T00:00:00Z",
          reward_lane_pending_review_at: "2026-09-01T00:00:00Z",
        },
        "conservative",
        NOW,
      ),
    ).toEqual({
      kind: "rail",
      join: "done",
      strategy: "done",
      honor: "blocked",
    });
    // Even a forfeited row reads review first — the freshest fact wins.
    expect(
      lifecycleView(
        {
          plan: "free",
          plan_forfeited_at: "2026-08-01T00:00:00Z",
          reward_lane_pending_review_at: "2026-09-01T00:00:00Z",
        },
        null,
        NOW,
      ),
    ).toEqual({
      kind: "rail",
      join: "upcoming",
      strategy: "upcoming",
      honor: "blocked",
    });
  });

  it("pending on a paid strategy: steps 1-2 done, step 3 current", () => {
    expect(lifecycleView({ plan: "pro" }, "conservative", NOW)).toEqual({
      kind: "rail",
      join: "done",
      strategy: "done",
      honor: "current",
    });
  });

  it("pending on Zero or custom rates: step 2 regresses to current", () => {
    expect(lifecycleView({ plan: "pro" }, "zero", NOW)).toEqual({
      kind: "rail",
      join: "done",
      strategy: "current",
      honor: "upcoming",
    });
    expect(lifecycleView({ plan: "pro" }, null, NOW)).toEqual({
      kind: "rail",
      join: "done",
      strategy: "current",
      honor: "upcoming",
    });
  });

  it("live on a paid strategy: collapses to the strip, tone by strikes", () => {
    expect(
      lifecycleView(
        { plan: "pro", plan_live_at: daysAgo(30) },
        "aggressive",
        NOW,
      ),
    ).toEqual({ kind: "strip", tone: "live", strikes: 0 });
    expect(
      lifecycleView(
        {
          plan: "pro",
          plan_live_at: daysAgo(60),
          strike_count: 1,
          last_strike_at: daysAgo(10),
        },
        "aggressive",
        NOW,
      ),
    ).toEqual({ kind: "strip", tone: "warn", strikes: 1 });
  });

  it("strip uses EFFECTIVE strikes — decayed strikes read clean", () => {
    expect(
      lifecycleView(
        {
          plan: "pro",
          plan_live_at: daysAgo(400),
          strike_count: 2,
          last_strike_at: daysAgo(STRIKE_DECAY_DAYS),
        },
        "aggressive",
        NOW,
      ),
    ).toEqual({ kind: "strip", tone: "live", strikes: 0 });
  });

  it("live but parked on Zero: rail returns with step 2 current, step 3 done", () => {
    expect(
      lifecycleView(
        { plan: "pro", plan_live_at: daysAgo(30) },
        "zero",
        NOW,
      ),
    ).toEqual({
      kind: "rail",
      join: "done",
      strategy: "current",
      honor: "done",
    });
  });

  it("paused: step 3 blocked", () => {
    expect(
      lifecycleView(
        {
          plan: "pro",
          plan_live_at: daysAgo(60),
          promo_paused_until: daysAgo(-10),
        },
        "conservative",
        NOW,
      ),
    ).toEqual({
      kind: "rail",
      join: "done",
      strategy: "done",
      honor: "blocked",
    });
  });

  it("forfeited: step 3 blocked, strategy resets (re-join re-picks)", () => {
    expect(
      lifecycleView({ plan_forfeited_at: daysAgo(1) }, "zero", NOW),
    ).toEqual({
      kind: "rail",
      join: "done",
      strategy: "upcoming",
      honor: "blocked",
    });
  });
});
