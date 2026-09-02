import { describe, expect, it } from "vitest";

import {
  ladderScore,
  ladderScoreMatchesPromotionScore,
  offeringRows,
  PROMOTION_SCORE_MAX,
  railWriteFailure,
  shouldRenderConfig,
  type ConnectState,
  type LadderInput,
} from "./offerings";

const OFF = { mesita_pay: false, credits: false, pickup: false, delivery: false };
const ALL = { mesita_pay: true, credits: true, pickup: true, delivery: true };

function input(over: Partial<LadderInput> = {}): LadderInput {
  return {
    member: false,
    visitRewardsLevel: 0,
    rails: { ...OFF },
    connect: { kind: "none" },
    ...over,
  };
}

const byKey = (i: LadderInput) =>
  Object.fromEntries(offeringRows(i).map((r) => [r.key, r]));

describe("the ladder", () => {
  it("is nine rows in dependency order, money band before service band", () => {
    const rows = offeringRows(input());
    expect(rows.map((r) => r.key)).toEqual([
      "partnership",
      "stripe",
      "mesita_pay",
      "visit_rewards",
      "accept_prepays",
      "sell_prepays",
      "pickup",
      "delivery",
      "reservations",
    ]);
    // The money ladder leads; the service rails follow. Never interleaved.
    const bands = rows.map((r) => r.band);
    expect(bands.indexOf("service")).toBe(6);
    expect(bands.lastIndexOf("money")).toBe(5);
  });

  it("names the prerequisite on every locked row — never a bare disabled switch", () => {
    const r = byKey(input());
    for (const key of ["stripe", "mesita_pay", "visit_rewards", "accept_prepays"]) {
      expect(r[key].state).toEqual({ kind: "locked", needs: "Needs the partnership" });
    }
    // Service rails are NOT gated — they behave exactly as they do today.
    for (const key of ["pickup", "delivery", "reservations"]) {
      expect(r[key].state.kind).not.toBe("locked");
    }
  });

  it("gates Mesita Pay on a CHARGE-READY account, not merely a present one", () => {
    const partnered = { member: true } as const;
    const states: [ConnectState, string][] = [
      [{ kind: "none" }, "locked"],
      [{ kind: "incomplete", requirementsDue: ["individual.id_number"] }, "locked"],
      [{ kind: "ready" }, "off"],
    ];
    for (const [connect, expected] of states) {
      const pay = byKey(input({ ...partnered, connect })).mesita_pay;
      expect(pay.state.kind).toBe(expected);
      if (pay.state.kind === "locked") {
        expect(pay.state.needs).toBe("Needs an active Stripe account");
      }
    }
  });

  it("relocks and quotes Stripe when an account is disabled after being live", () => {
    const r = byKey(
      input({
        member: true,
        connect: { kind: "disabled", reason: "requirements.past_due" },
      }),
    );
    expect(r.stripe.state).toEqual({ kind: "blocked", reason: "requirements.past_due" });
    // Pay cannot stay actionable while the account that receives the money is off.
    expect(r.mesita_pay.state.kind).toBe("locked");
  });

  it("surfaces the outstanding requirement count in the Stripe row's own detail", () => {
    const one = byKey(
      input({ member: true, connect: { kind: "incomplete", requirementsDue: ["dob"] } }),
    ).stripe;
    const two = byKey(
      input({ member: true, connect: { kind: "incomplete", requirementsDue: ["dob", "id"] } }),
    ).stripe;
    expect(one.detail).toContain("1 detail before");
    expect(two.detail).toContain("2 details before");
  });

  it("lets a partner redeem prepays WITHOUT Stripe — redemption is not a charge", () => {
    // The correction to the briefed ladder: a bill discount moves no money, so
    // it cannot depend on the charge path.
    const r = byKey(input({ member: true, connect: { kind: "none" } }));
    expect(r.accept_prepays.state).toEqual({ kind: "off" });
    expect(r.accept_prepays.detail).toContain("never a payment");
  });

  it("gates SELLING prepays on Mesita Pay, and parks it behind Soon once unlocked", () => {
    const locked = byKey(input({ member: true, connect: { kind: "ready" } })).sell_prepays;
    expect(locked.state).toEqual({ kind: "locked", needs: "Needs Mesita Pay" });

    const soon = byKey(
      input({ member: true, connect: { kind: "ready" }, rails: { ...OFF, mesita_pay: true } }),
    ).sell_prepays;
    // Locked outranks Soon: a prerequisite an operator can act on beats a ship
    // date they cannot.
    expect(soon.state).toEqual({ kind: "soon" });
  });

  it("keeps 'Credits' out of operator copy — the label is Prepays (MESITA-1380)", () => {
    const rows = offeringRows(input({ member: true }));
    const copy = rows.map((r) => `${r.label} ${r.detail}`).join(" ");
    expect(copy).not.toMatch(/\bCredits?\b/);
    expect(copy).toContain("Accept Prepays");
    expect(copy).toContain("Sell Prepays");
  });
});

describe("the points column and the header meter are ONE claim", () => {
  it("sums to promotionScore for every rail/level/partner combination", () => {
    for (const member of [false, true]) {
      for (const visitRewardsLevel of [0, 1, 2, 3]) {
        for (const mesita_pay of [false, true]) {
          for (const credits of [false, true]) {
            for (const pickup of [false, true]) {
              for (const delivery of [false, true]) {
                const i = input({
                  member,
                  visitRewardsLevel,
                  connect: { kind: "ready" },
                  rails: { mesita_pay, credits, pickup, delivery },
                });
                expect(ladderScoreMatchesPromotionScore(i)).toBe(true);
              }
            }
          }
        }
      }
    }
  });

  it("tops out at PROMOTION_SCORE_MAX and bottoms at zero", () => {
    expect(
      ladderScore(
        offeringRows(
          input({
            member: true,
            visitRewardsLevel: 2,
            rails: { ...ALL },
            connect: { kind: "ready" },
          }),
        ),
      ),
    ).toBe(PROMOTION_SCORE_MAX);
    expect(ladderScore(offeringRows(input()))).toBe(0);
  });

  it("marks the three rows that can NEVER score, so the meter stays explainable", () => {
    // promotionScore counts six things; the ladder shows nine. Without this the
    // operator cannot reconcile the number with the list.
    const r = byKey(input({ member: true, connect: { kind: "ready" } }));
    expect(r.stripe.points).toBeNull();
    expect(r.sell_prepays.points).toBeNull();
    expect(r.reservations.points).toBeNull();
  });
});

describe("railWriteFailure", () => {
  it("states the outcome, names the row, and never leaks the Edge Function error", () => {
    expect(railWriteFailure("Mesita Pay", true)).toBe(
      "Couldn't turn Mesita Pay on. Nothing changed — try again.",
    );
    expect(railWriteFailure("Accept Prepays", false)).toBe(
      "Couldn't turn Accept Prepays off. Nothing changed — try again.",
    );
  });
});

describe("shouldRenderConfig — the keep-mounted guard", () => {
  it("renders a dirty config even when its switch is off", () => {
    // THE regression this exists to prevent: unmounting runs
    // registerSaver(section, null) and drops the pending edit silently.
    expect(shouldRenderConfig(false, true)).toBe(true);
  });

  it("renders whenever the capability is on, dirty or not", () => {
    expect(shouldRenderConfig(true, false)).toBe(true);
    expect(shouldRenderConfig(true, true)).toBe(true);
  });

  it("hides only the case that is both off and clean — nothing to lose", () => {
    expect(shouldRenderConfig(false, false)).toBe(false);
  });
});
