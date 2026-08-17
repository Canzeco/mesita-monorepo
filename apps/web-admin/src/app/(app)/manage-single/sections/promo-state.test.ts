import { describe, expect, it } from "vitest";
import { STRATEGIES, strategyForPlace } from "@/lib/business/strategies";
import {
  ACTION_KEYS,
  CLASS_KEYS,
  DEFAULT_PROMOS,
  totalFor,
  type PromosConfig,
} from "@/app/(app)/rewards-config/promos";
import {
  METER_SEGMENTS,
  STRIKE_DECAY_DAYS,
  describeMembershipStatus,
  effectiveStrikeCount,
  giveLevel,
  lifecycleView,
  membershipPillState,
  promoCardState,
  visibilityDots,
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

describe("giveLevel — the card's number and meter", () => {
  it("Zero is empty; the top posture fills the rail", () => {
    expect(giveLevel(DEFAULT_PROMOS, "zero")).toEqual({
      dots: 0,
      mean: 0,
      p10: 0,
      p90: 0,
    });
    expect(giveLevel(DEFAULT_PROMOS, "aggressive").dots).toBe(METER_SEGMENTS);
    expect(giveLevel(DEFAULT_PROMOS, "conservative").dots).toBe(2);
  });

  it("quotes the EXPECTED rate, not a matrix extreme (MESITA-1001)", () => {
    const cons = giveLevel(DEFAULT_PROMOS, "conservative");
    const aggr = giveLevel(DEFAULT_PROMOS, "aggressive");
    // Straight off distribution-model, the same numbers the Playground charts.
    // v11 lifted both means a point (19→20, 32→34): the Premium plan uplift
    // now applies across the whole class ladder, not at one `premium` row.
    // Raising Google 10→15 widened the top of the band (p90 30→35 / 50→55)
    // without moving the mean — only one visit in ten claims that rung.
    expect(cons.mean).toBe(21);
    expect(aggr.mean).toBe(34);
    expect([cons.p10, cons.p90]).toEqual([10, 35]);
    expect([aggr.p10, aggr.p90]).toEqual([20, 55]);
  });

  it("the mean sits inside the quoted band", () => {
    for (const id of ["conservative", "aggressive"] as const) {
      const g = giveLevel(DEFAULT_PROMOS, id);
      expect(g.mean).toBeGreaterThanOrEqual(g.p10);
      expect(g.mean).toBeLessThanOrEqual(g.p90);
    }
  });

  it("the band excludes the rare extremes the old range headlined", () => {
    // The old card printed min–max of the matrix cells. The true ceiling is
    // higher than any single cell (bonuses stack) AND lands on ~0.01% of
    // visits — the band must sit well below it.
    const cells = CLASS_KEYS.flatMap((c) =>
      ACTION_KEYS.map((a) =>
        Math.min(70, totalFor(DEFAULT_PROMOS, "aggressive", c, "free", a)),
      ),
    );
    expect(giveLevel(DEFAULT_PROMOS, "aggressive").p90).toBeLessThan(
      Math.max(...cells),
    );
  });

  it("a paying posture never rounds down to an empty meter", () => {
    // Conservative shaved to a single point against a 50-point Aggressive
    // rounds below half a segment — it must still light one.
    const lopsided: PromosConfig = structuredClone(DEFAULT_PROMOS);
    for (const cls of CLASS_KEYS) {
      lopsided.visits.base.conservative[cls] = { free: 1, premium: 1 };
      lopsided.visits.base.aggressive[cls] = { free: 50, premium: 50 };
    }
    expect(giveLevel(lopsided, "conservative").dots).toBe(1);
  });

  it("an all-zero config lights nothing (no divide-by-zero)", () => {
    const off: PromosConfig = structuredClone(DEFAULT_PROMOS);
    for (const cls of CLASS_KEYS) {
      off.visits.base.conservative[cls] = { free: 0, premium: 0 };
      off.visits.base.aggressive[cls] = { free: 0, premium: 0 };
    }
    off.visits.bonuses = { welcome: 0, mesita: 0, story: 0, google: 0 };
    expect(giveLevel(off, "aggressive").dots).toBe(0);
  });
});

describe("visibilityDots", () => {
  it("gives the rail exactly as many rungs as the ladder has", () => {
    expect(visibilityDots("Low")).toBe(1);
    expect(visibilityDots("Mid")).toBe(2);
    expect(visibilityDots("High")).toBe(METER_SEGMENTS);
    expect(METER_SEGMENTS).toBe(3);
  });
});

describe("promoCardState — the F1 regression class", () => {
  it("non-member: NEVER selected, every card is a Join door (Zero included)", () => {
    for (const cardId of [
      "zero",
      "conservative",
      "aggressive",
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
        cardId: "aggressive",
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
        "aggressive",
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

  it("leftover Dominant rates (40/50/20/30) display as Aggressive (MESITA-993)", () => {
    expect(
      strategyForPlace({
        welcome_free_rate: 40,
        welcome_premium_rate: 50,
        free_rate: 20,
        premium_rate: 30,
      }),
    ).toBe("aggressive");
  });
});
