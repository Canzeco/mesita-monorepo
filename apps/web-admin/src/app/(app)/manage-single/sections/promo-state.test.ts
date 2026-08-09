import { describe, expect, it } from "vitest";
import { STRATEGIES, strategyForPlace } from "@/lib/business/strategies";
import {
  STRIKE_DECAY_DAYS,
  describeMembershipStatus,
  effectiveStrikeCount,
  lifecycleView,
  membershipPillState,
  promoCardState,
} from "./promo-state";

const DAY_MS = 86_400_000;
const NOW = Date.parse("2026-08-07T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * DAY_MS).toISOString();

describe("membershipPillState", () => {
  it("maps the five states", () => {
    expect(
      membershipPillState({ membership_forfeited_at: daysAgo(1) }, NOW),
    ).toBe("forfeited");
    expect(membershipPillState({ plan: "free" }, NOW)).toBe("not_member");
    expect(membershipPillState({ plan: null }, NOW)).toBe("not_member");
    expect(
      membershipPillState(
        { plan: "pro", promo_paused_until: daysAgo(-10) },
        NOW,
      ),
    ).toBe("paused");
    expect(
      membershipPillState(
        { plan: "pro", membership_live_at: daysAgo(30) },
        NOW,
      ),
    ).toBe("live");
    expect(membershipPillState({ plan: "pro" }, NOW)).toBe("pending");
  });

  it("ignores an expired pause", () => {
    expect(
      membershipPillState(
        {
          plan: "pro",
          promo_paused_until: daysAgo(5),
          membership_live_at: daysAgo(60),
        },
        NOW,
      ),
    ).toBe("live");
  });

  it("forfeited wins over everything (defensive)", () => {
    expect(
      membershipPillState(
        {
          plan: "pro",
          membership_forfeited_at: daysAgo(2),
          membership_live_at: daysAgo(60),
        },
        NOW,
      ),
    ).toBe("forfeited");
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
    expect(
      effectiveStrikeCount(
        { strike_count: 2, last_strike_at: daysAgo(STRIKE_DECAY_DAYS + 1) },
        NOW,
      ),
    ).toBe(0);
  });

  it("trusts the raw count when last_strike_at is missing", () => {
    expect(effectiveStrikeCount({ strike_count: 1 }, NOW)).toBe(1);
  });
});

describe("describeMembershipStatus", () => {
  it("paused is warn (amber), never destructive red, and names the ladder", () => {
    const note = describeMembershipStatus(
      { plan: "pro", promo_paused_until: daysAgo(-10) },
      "paused",
      NOW,
    );
    expect(note?.tone).toBe("warn");
    expect(note?.label).toContain("(strike 2 of 3)");
  });

  it("live with decayed strikes reads clean", () => {
    const note = describeMembershipStatus(
      {
        plan: "pro",
        membership_live_at: daysAgo(400),
        strike_count: 2,
        last_strike_at: daysAgo(200),
      },
      "live",
      NOW,
    );
    expect(note?.tone).toBe("live");
    expect(note?.label).toBe("Membership live — promo lane open.");
  });

  it("live with an active strike warns with the effective count", () => {
    const note = describeMembershipStatus(
      {
        plan: "pro",
        membership_live_at: daysAgo(60),
        strike_count: 1,
        last_strike_at: daysAgo(10),
      },
      "live",
      NOW,
    );
    expect(note?.tone).toBe("warn");
    expect(note?.label).toContain("1 active strike (of 3)");
  });

  it("forfeited is blocked; not_member has no note; pending warns", () => {
    expect(describeMembershipStatus({}, "forfeited", NOW)?.tone).toBe(
      "blocked",
    );
    expect(describeMembershipStatus({ plan: "free" }, "not_member", NOW)).toBe(
      null,
    );
    expect(
      describeMembershipStatus({ plan: "pro" }, "pending", NOW)?.tone,
    ).toBe("warn");
  });
});

describe("promoCardState — the F1 regression class", () => {
  it("non-member: NEVER selected, every card is a Join door (Zero included)", () => {
    for (const cardId of [
      "zero",
      "conservative",
      "aggressive",
      "dominant",
    ] as const) {
      const st = promoCardState({
        member: false,
        forfeited: false,
        // A fresh/dropped place has all-null rates → strategyForPlace says
        // "zero"; the gate must ignore it.
        storedStrategy: "zero",
        cardId,
        paid: cardId !== "zero",
      });
      expect(st.selected).toBe(false);
      expect(st.cta).toBe("join");
    }
  });

  it("forfeited: every card reinstates (and wins over member, defensively)", () => {
    for (const member of [false, true]) {
      const st = promoCardState({
        member,
        forfeited: true,
        storedStrategy: "zero",
        cardId: "conservative",
        paid: true,
      });
      expect(st.selected).toBe(false);
      expect(st.cta).toBe("reinstate");
    }
  });

  it("member on Zero (null rates): Zero is honestly Current", () => {
    const st = promoCardState({
      member: true,
      forfeited: false,
      storedStrategy: "zero",
      cardId: "zero",
      paid: false,
    });
    expect(st).toEqual({ selected: true, cta: "current" });
  });

  it("member switching: paid cards Switch, Zero card Switch-to-Zero", () => {
    expect(
      promoCardState({
        member: true,
        forfeited: false,
        storedStrategy: "conservative",
        cardId: "dominant",
        paid: true,
      }),
    ).toEqual({ selected: false, cta: "switch" });
    expect(
      promoCardState({
        member: true,
        forfeited: false,
        storedStrategy: "conservative",
        cardId: "zero",
        paid: false,
      }),
    ).toEqual({ selected: false, cta: "switch_zero" });
  });

  it("member with custom rates (no stored strategy): nothing selected", () => {
    const st = promoCardState({
      member: true,
      forfeited: false,
      storedStrategy: null,
      cardId: "conservative",
      paid: true,
    });
    expect(st.selected).toBe(false);
    expect(st.cta).toBe("switch");
  });
});

describe("lifecycleView — the Box 0 stepper state machine", () => {
  it("not_member: step 1 current, rest upcoming (Zero match ignored via gate)", () => {
    // Fresh place: all-null rates → strategyForPlace says "zero"; the member
    // gate must keep step 2 from reading it as chosen.
    expect(lifecycleView({ plan: "free" }, "zero", NOW)).toEqual({
      kind: "rail",
      join: "current",
      strategy: "upcoming",
      honor: "upcoming",
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
        { plan: "pro", membership_live_at: daysAgo(30) },
        "aggressive",
        NOW,
      ),
    ).toEqual({ kind: "strip", tone: "live", strikes: 0 });
    expect(
      lifecycleView(
        {
          plan: "pro",
          membership_live_at: daysAgo(60),
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
          membership_live_at: daysAgo(400),
          strike_count: 2,
          last_strike_at: daysAgo(STRIKE_DECAY_DAYS),
        },
        "dominant",
        NOW,
      ),
    ).toEqual({ kind: "strip", tone: "live", strikes: 0 });
  });

  it("live but parked on Zero: rail returns with step 2 current, step 3 done", () => {
    expect(
      lifecycleView(
        { plan: "pro", membership_live_at: daysAgo(30) },
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
          membership_live_at: daysAgo(60),
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
      lifecycleView({ membership_forfeited_at: daysAgo(1) }, "zero", NOW),
    ).toEqual({
      kind: "rail",
      join: "done",
      strategy: "upcoming",
      honor: "blocked",
    });
  });
});

describe("strategyForPlace contract (locks the documented trap)", () => {
  it("all-null rates match Zero — the reason selected must be member-gated", () => {
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
});
