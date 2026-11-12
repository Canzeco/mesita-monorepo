// Money (MESITA-3772): one open payment per guest. Picking the wrong one
// lets a guest open a second payment or hides the one still waiting for the
// waiter; the wrong end button closes a payment that should only be
// cancelled (the credit then stays spent and no cashback is earned).
import { describe, expect, it } from "vitest";
import { endAction, type EndTab, pickOpenGuestPayment } from "@/lib/pay-open";

const NOW = Date.parse("2026-11-11T20:00:00Z");
const LATER = "2026-11-11T22:00:00Z";
const EARLIER = "2026-11-11T19:00:00Z";

type Row = Parameters<typeof pickOpenGuestPayment>[0][number] & { tab_id: string };

function row(over: Partial<Row> = {}): Row {
  return {
    tab_id: "t1",
    origin: "guest",
    verified_at: null,
    status: "paying",
    expires_at: LATER,
    created_at: "2026-11-11T19:30:00Z",
    ...over,
  };
}

describe("the guest's open payment, from their visits", () => {
  it("an unsigned guest payment, paying or paid, inside its window, is open", () => {
    expect(pickOpenGuestPayment([row()], NOW)?.tab_id).toBe("t1");
    expect(pickOpenGuestPayment([row({ status: "paid" })], NOW)?.tab_id).toBe("t1");
  });

  it("signed, ended, past its window, or a waiter's tab is not", () => {
    expect(pickOpenGuestPayment([row({ verified_at: EARLIER })], NOW)).toBeNull();
    expect(pickOpenGuestPayment([row({ status: "expired" }), row({ status: "cancelled" })], NOW)).toBeNull();
    expect(pickOpenGuestPayment([row({ status: "waiting_bill" }), row({ status: "billed" })], NOW)).toBeNull();
    expect(pickOpenGuestPayment([row({ expires_at: EARLIER })], NOW)).toBeNull();
    expect(pickOpenGuestPayment([row({ origin: "waiter" })], NOW)).toBeNull();
    // An older server with no origin: the device's own list finds it instead.
    expect(pickOpenGuestPayment([row({ origin: undefined })], NOW)).toBeNull();
  });

  it("the newest open one wins among closed ones", () => {
    const v = pickOpenGuestPayment(
      [
        row({ tab_id: "old", created_at: "2026-11-11T18:00:00Z" }),
        row({ tab_id: "signed", created_at: "2026-11-11T19:50:00Z", verified_at: EARLIER }),
        row({ tab_id: "new", created_at: "2026-11-11T19:40:00Z" }),
      ],
      NOW,
    );
    expect(v?.tab_id).toBe("new");
  });

  it("no visits, no open payment", () => {
    expect(pickOpenGuestPayment([], NOW)).toBeNull();
  });
});

const part = (p: string, status: string, paid = false) => ({ id: `${p}-${status}`, part: p, status, paid_at: paid ? EARLIER : null });

function tab(over: Partial<EndTab> = {}): EndTab {
  return { status: "paying", expires_at: LATER, verified_at: null, cash_bill_cents: 0, cash_tip_cents: 0, parts: [], ...over };
}

describe("Cancel, Close or nothing at the bottom of the payment", () => {
  it("nothing moved yet (cash waiting): Cancel", () => {
    expect(endAction(tab({ cash_bill_cents: 50_000, parts: [part("outside", "open")] }), NOW)).toBe("cancel");
  });

  it("money moved and nobody signed: Close", () => {
    expect(endAction(tab({ status: "paid", parts: [part("card", "paid", true)] }), NOW)).toBe("close");
    expect(endAction(tab({ cash_tip_cents: 5_000, parts: [part("card", "paid", true), part("outside", "open")] }), NOW)).toBe("close");
  });

  it("a card still going through: neither", () => {
    expect(endAction(tab({ parts: [part("card", "open")] }), NOW)).toBeNull();
    expect(endAction(tab({ parts: [part("card", "opening")] }), NOW)).toBeNull();
  });

  it("signed, over, refunded or being checked: neither", () => {
    expect(endAction(tab({ status: "paid", verified_at: EARLIER, parts: [part("card", "paid", true)] }), NOW)).toBeNull();
    expect(endAction(tab({ expires_at: EARLIER, parts: [part("card", "paid", true)] }), NOW)).toBeNull();
    expect(endAction(tab({ status: "cancelled" }), NOW)).toBeNull();
    expect(endAction(tab({ status: "expired" }), NOW)).toBeNull();
    expect(endAction(tab({ status: "paid", parts: [part("card", "refunded", true)] }), NOW)).toBeNull();
    expect(endAction(tab({ status: "paid", parts: [part("card", "needs_review", true)] }), NOW)).toBeNull();
  });
});
