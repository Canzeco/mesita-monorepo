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
      total_cents: 132000,
      cash_due_cents: 102000,
      cashback_cents: 1800,
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
});
