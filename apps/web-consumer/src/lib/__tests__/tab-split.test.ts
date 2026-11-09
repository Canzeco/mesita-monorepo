import { describe, expect, it } from "vitest";
import { tabSplit } from "@/lib/api/tab";

// Money (MVP test rule): what the guest is asked to pay at the table. Credits
// never pay the tip; cashback is never on credit or the tip.
describe("tabSplit", () => {
  it("credit first, the rest of the bill and the whole tip in cash", () => {
    expect(tabSplit({ billCents: 120000, tipCents: 12000, spendableCents: 30000, useCredit: true, cashBackBps: 200 })).toEqual({
      credit_cents: 30000,
      cash_bill_cents: 90000,
      cash_tip_cents: 12000,
      card_bill_cents: 0,
      card_tip_cents: 0,
      total_cents: 132000,
      cash_due_cents: 102000,
      card_due_cents: 0,
      cashback_cents: 1800,
      card_tip_alone: false,
    });
  });

  it("credit never covers more than the bill, never the tip", () => {
    const s = tabSplit({ billCents: 50000, tipCents: 5000, spendableCents: 90000, useCredit: true, cashBackBps: 200 });
    expect(s.credit_cents).toBe(50000);
    expect(s.cash_bill_cents).toBe(0);
    expect(s.cash_tip_cents).toBe(5000);
    expect(s.cashback_cents).toBe(0);
  });

  it("without credit the whole bill is cash; cashback off pays nothing back", () => {
    const s = tabSplit({ billCents: 10000, tipCents: 0, spendableCents: 30000, useCredit: false, cashBackBps: 0 });
    expect(s).toMatchObject({ credit_cents: 0, cash_bill_cents: 10000, cash_due_cents: 10000, cashback_cents: 0 });
  });

  it("cashback rounds down to the centavo", () => {
    expect(tabSplit({ billCents: 999, tipCents: 0, spendableCents: 0, useCredit: true, cashBackBps: 200 }).cashback_cents).toBe(19);
  });

  it("the rest of the bill by card: 5% back on the card bill part, never the tip", () => {
    const s = tabSplit({
      billCents: 100000, tipCents: 10000, spendableCents: 20000, useCredit: true,
      cashBackBps: 200, cardBackBps: 500, billWith: "card", tipWith: "card",
    });
    expect(s).toMatchObject({
      credit_cents: 20000, cash_bill_cents: 0, cash_tip_cents: 0,
      card_bill_cents: 80000, card_tip_cents: 10000,
      cash_due_cents: 0, card_due_cents: 90000, total_cents: 110000,
      cashback_cents: 4000, card_tip_alone: false,
    });
  });

  it("bill in cash, tip by card: 2% on the cash bill part; a card tip alone is flagged", () => {
    const s = tabSplit({
      billCents: 50000, tipCents: 5000, spendableCents: 0, useCredit: true,
      cashBackBps: 200, cardBackBps: 500, billWith: "cash", tipWith: "card",
    });
    expect(s).toMatchObject({ cash_bill_cents: 50000, card_tip_cents: 5000, cashback_cents: 1000, card_tip_alone: true });
  });

  it("a card tip with part of the bill by credit is allowed", () => {
    const s = tabSplit({
      billCents: 50000, tipCents: 5000, spendableCents: 10000, useCredit: true,
      cashBackBps: 200, cardBackBps: 500, billWith: "cash", tipWith: "card",
    });
    expect(s.card_tip_alone).toBe(false);
    expect(s.cashback_cents).toBe(800);
  });
});
