import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLACE,
  DEFAULT_SCENARIO,
  type Event,
  PLACE,
  type Scenario,
  type State,
  fees,
  initialState,
  quote,
  transition,
} from "./flow";

const run = (s: State, ...events: Event[]) => events.reduce((acc, e) => transition(acc, e, 1000), s);
const start = (scenario: Partial<Scenario> = {}) => initialState({ ...DEFAULT_SCENARIO, ...scenario });
const code = (text: string = PLACE.code): Event => ({ type: "WAITER_CODE", text });

/** Pick → Bill → Tip (10%) → next. Default bill 730, credit 300, tip 73. */
const toAfterTip = (s: State) => run(s, { type: "START" }, { type: "BILL_NEXT" }, { type: "TIP_NEXT" });

const buyAndSign = (s: State) => run(toAfterTip(s), { type: "UPSELL_BUY" }, { type: "METHOD_NEXT" });
const skipCashSign = (s: State) =>
  run(toAfterTip(s), { type: "UPSELL_SKIP" }, { type: "CHOOSE_METHOD", method: "cash" }, { type: "METHOD_NEXT" }, { type: "CASH_PAID" });

describe("the eight steps", () => {
  it("default path: Medium offer, card hold, sign, capture, receipt", () => {
    let s = toAfterTip(start());
    expect(s.bill.step).toBe("upsell");
    expect(s.bill.offer!.charge).toBe(1073);
    s = run(s, { type: "UPSELL_BUY" });
    expect(s.bill.step).toBe("method");
    s = run(s, { type: "METHOD_NEXT" });
    expect(s.bill.step).toBe("sign");
    expect(s.bill.hold).toBe(1073);
    s = run(s, { type: "WAITER_SCAN" }, code(), { type: "WAITER_VERIFY" });
    expect(s.bill.step).toBe("cardPay");
    s = run(s, { type: "CAPTURE" });
    expect(s.bill.step).toBe("receipt");
    expect(s.wallet.credit).toBe(300 + 1000 - 730);
    expect(s.wallet.pending.map((p) => p.amount)).toEqual([200]);
    expect(s.bill.payments).toEqual([{ kind: "card", amount: 1073 }]);
    expect(s.bill.receipt!.tipHow).toBe("card");
  });

  it("credit covers the bill: only the tip is left, paid by card", () => {
    let s = toAfterTip(start({ credit: 1000 }));
    expect(s.bill.step).toBe("method");
    expect(quote(s).due).toBe(73);
    s = run(s, { type: "CHOOSE_METHOD", method: "card" }, { type: "METHOD_NEXT" }, { type: "WAITER_SCAN" }, code(), { type: "WAITER_VERIFY" }, { type: "CAPTURE" });
    expect(s.bill.payments).toEqual([{ kind: "card", amount: 73 }]);
    expect(s.wallet.credit).toBe(270);
    expect(s.history.tipsByCard).toBe(73);
  });

  it("credit covers the bill and no tip: nothing to pay, straight to Sign", () => {
    let s = run(start({ credit: 1000 }), { type: "START" }, { type: "BILL_NEXT" }, { type: "SET_TIP", kind: "none" }, { type: "TIP_NEXT" });
    expect(s.bill.step).toBe("sign");
    s = run(s, { type: "WAITER_SCAN" }, code(), { type: "WAITER_VERIFY" });
    expect(s.bill.step).toBe("receipt");
    expect(s.bill.payments).toEqual([]);
  });

  it("skip + cash: one payment at the table for the rest plus tip", () => {
    let s = skipCashSign(start());
    expect(s.bill.step).toBe("sign");
    s = run(s, { type: "WAITER_SCAN" }, { type: "WAITER_CASH_CHECK", checked: true }, code(), { type: "WAITER_VERIFY" });
    expect(s.bill.payments).toEqual([{ kind: "cash", amount: 503 }]);
    expect(s.wallet.credit).toBe(0);
  });

  it("skip + card pays the rest of the bill directly", () => {
    let s = run(toAfterTip(start()), { type: "UPSELL_SKIP" }, { type: "CHOOSE_METHOD", method: "card" }, { type: "METHOD_NEXT" });
    expect(s.bill.hold).toBe(503);
    s = run(s, { type: "WAITER_SCAN" }, code(), { type: "WAITER_VERIFY" }, { type: "CAPTURE" });
    expect(s.bill.payments).toEqual([{ kind: "card", amount: 503 }]);
  });

  it("the offer is shown once: a skip stays a skip after Start again", () => {
    let s = run(skipCashSign(start()), { type: "CANCEL" }, { type: "START_AGAIN" });
    expect(s.bill.amountText).toBe("730");
    s = run(s, { type: "BILL_NEXT" }, { type: "TIP_NEXT" });
    expect(s.bill.step).toBe("method");
    expect(s.bill.offer).toBeNull();
  });
});

describe("one payment per bill", () => {
  it("never records a second payment, whatever is replayed", () => {
    for (const s0 of [buyAndSign(start()), skipCashSign(start())]) {
      const s = run(
        s0,
        { type: "WAITER_SCAN" },
        { type: "WAITER_CASH_CHECK", checked: true },
        code(),
        { type: "WAITER_VERIFY" },
        { type: "CAPTURE" },
        { type: "CAPTURE" },
        { type: "WAITER_VERIFY" },
        { type: "CASH_PAID" },
      );
      expect(s.bill.step).toBe("receipt");
      expect(s.bill.payments).toHaveLength(1);
    }
  });

  it("cash is not available for a voucher", () => {
    const s = run(toAfterTip(start()), { type: "UPSELL_BUY" }, { type: "CHOOSE_METHOD", method: "cash" });
    expect(s.bill.method).toBe("card");
  });
});

describe("credit and the tip", () => {
  it("credit never pays the tip", () => {
    const s = toAfterTip(start({ credit: 800 }));
    const q = quote(s);
    expect(q.creditApplied).toBe(730);
    expect(q.due).toBe(73);
  });

  it("a voucher's bonus never pays the bill it was bought at", () => {
    const s = run(buyAndSign(start()), { type: "WAITER_SCAN" }, code(), { type: "WAITER_VERIFY" }, { type: "CAPTURE" });
    expect(s.bill.receipt!.creditUsed).toBe(730);
    expect(s.wallet.credit).toBe(570);
    expect(s.bill.receipt!.pendingBonus).toBe(200);
  });
});

describe("reserve, deduct, release", () => {
  it("reserves at Sign and deducts only at verify", () => {
    let s = skipCashSign(start());
    expect(s.wallet).toMatchObject({ credit: 300, reserved: 300 });
    s = run(s, { type: "WAITER_SCAN" }, { type: "WAITER_CASH_CHECK", checked: true }, code(), { type: "WAITER_VERIFY" });
    expect(s.wallet).toMatchObject({ credit: 0, reserved: 0 });
  });

  for (const [name, events] of [
    ["reject", [{ type: "WAITER_SCAN" }, { type: "WAITER_REJECT" }]],
    ["cancel", [{ type: "CANCEL" }]],
  ] as const) {
    it(`releases on ${name} and takes nothing`, () => {
      const s = run(buyAndSign(start()), ...(events as unknown as Event[]));
      expect(s.bill.step).toBe("notPaid");
      expect(s.wallet).toMatchObject({ credit: 300, reserved: 0, pending: [] });
      expect(s.bill.hold).toBeNull();
      expect(s.bill.payments).toEqual([]);
      expect(s.history.moneyIn).toBe(0);
    });
  }

  it("releases on timeout, only once the deadline has passed", () => {
    const s = buyAndSign(start());
    const early = transition(s, { type: "TIMEOUT" }, s.bill.deadline! - 1);
    expect(early.bill.step).toBe("sign");
    const late = transition(s, { type: "TIMEOUT" }, s.bill.deadline!);
    expect(late.bill.step).toBe("notPaid");
    expect(late.wallet.reserved).toBe(0);
  });

  it("after a reject, Start again keeps the purchase choice and charges once", () => {
    let s = run(buyAndSign(start()), { type: "WAITER_SCAN" }, { type: "WAITER_REJECT" }, { type: "START_AGAIN" });
    expect(s.bill.step).toBe("bill");
    s = run(s, { type: "BILL_NEXT" }, { type: "TIP_NEXT" });
    expect(s.bill.step).toBe("method");
    s = run(s, { type: "METHOD_NEXT" }, { type: "WAITER_SCAN" }, code(), { type: "WAITER_VERIFY" }, { type: "CAPTURE" });
    expect(s.bill.payments).toEqual([{ kind: "card", amount: 1073 }]);
    expect(s.history.vouchersSold).toBe(1);
  });
});

describe("cards and the waiter", () => {
  it("a declined card leaves everything else unchanged", () => {
    const before = run(toAfterTip(start({ cardResult: "declined" })), { type: "UPSELL_BUY" });
    const after = run(before, { type: "METHOD_NEXT" });
    expect(after.bill.step).toBe("method");
    expect(after.bill.methodError).toMatch(/declined/);
    expect({ ...after.bill, methodError: null }).toEqual({ ...before.bill, methodError: null });
    expect(after.wallet).toEqual(before.wallet);
    expect(after.history).toEqual(before.history);
  });

  it("cash needs the waiter's received box before the code", () => {
    let s = run(skipCashSign(start()), { type: "WAITER_SCAN" }, code(), { type: "WAITER_VERIFY" });
    expect(s.bill.step).toBe("sign");
    expect(s.bill.waiterError).toBe("Confirm you received the money");
    s = run(s, { type: "WAITER_CASH_CHECK", checked: true }, { type: "WAITER_VERIFY" });
    expect(s.bill.step).toBe("receipt");
  });

  it("rejects a short or wrong code", () => {
    const s = run(buyAndSign(start()), { type: "WAITER_SCAN" }, code("123"), { type: "WAITER_VERIFY" });
    expect(s.bill.waiterError).toBe("Enter the 6-digit code");
    const w = run(s, code("111111"), { type: "WAITER_VERIFY" });
    expect(w.bill.waiterError).toBe("Wrong code. Try again.");
  });

  it("an empty bill does not advance", () => {
    const s = run(start(), { type: "START" }, { type: "SET_AMOUNT", text: "" }, { type: "BILL_NEXT" });
    expect(s.bill.step).toBe("bill");
    expect(s.bill.amountError).toBe("Enter the bill amount");
  });
});

describe("the console", () => {
  it("results update after a voucher purchase; tips carry no fee", () => {
    const s = run(buyAndSign(start()), { type: "WAITER_SCAN" }, code(), { type: "WAITER_VERIFY" }, { type: "CAPTURE" });
    expect(s.history).toMatchObject({ vouchersSold: 1, moneyIn: 1000, bonusOwed: 200, tipsByCard: 73 });
    expect(fees(s.history)).toEqual({ vouchers: 50, tips: 0 });
  });

  it("settings apply to the next bill, not an open one", () => {
    let s = toAfterTip(start());
    s = run(s, { type: "SET_PLACE", place: { ...DEFAULT_PLACE, upsellOn: false } });
    expect(s.bill.step).toBe("upsell");
    expect(s.bill.settings.upsellOn).toBe(true);
    s = run(s, { type: "RESTART", scenario: DEFAULT_SCENARIO });
    s = toAfterTip(s);
    expect(s.bill.step).toBe("method");
  });

  it("upselling is forced off without vouchers or a card-taking Stripe account", () => {
    expect(toAfterTip(start({ vouchersModule: false })).bill.step).toBe("method");
    expect(toAfterTip(start({ stripeCards: false })).bill.step).toBe("method");
  });

  it("checkout off: nothing works", () => {
    const s = run(initialState(DEFAULT_SCENARIO, { ...DEFAULT_PLACE, checkoutOn: false }), { type: "START" });
    expect(s.bill.step).toBe("pick");
  });

  it("Welcome for a new guest, once ever", () => {
    let s = run(start({ credit: 0, billPrefill: 90, newGuest: true }), { type: "START" }, { type: "BILL_NEXT" }, { type: "TIP_NEXT" });
    expect(s.bill.offer!.lines[0].voucher.id).toBe("welcome");
    s = run(s, { type: "UPSELL_BUY" }, { type: "METHOD_NEXT" }, { type: "WAITER_SCAN" }, code(), { type: "WAITER_VERIFY" }, { type: "CAPTURE" });
    expect(s.wallet.welcomeUsed).toBe(true);
    s = run(s, { type: "DONE" }, { type: "START" }, { type: "SET_AMOUNT", text: "500" }, { type: "BILL_NEXT" }, { type: "TIP_NEXT" });
    expect(s.bill.offer!.lines.some((l) => l.voucher.id === "welcome")).toBe(false);
  });
});
