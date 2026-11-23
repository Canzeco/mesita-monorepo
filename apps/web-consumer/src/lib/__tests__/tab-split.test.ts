import { describe, expect, it } from "vitest";
import { tabSplit } from "@/lib/api/tab";

// Money (MVP test rule): what the guest is asked to pay at the table. Credits
// never pay the tip; the rest goes in cash (MESITA-4708: no card part).
describe("tabSplit", () => {
  it("credit first, the rest of the bill and the whole tip in cash", () => {
    expect(tabSplit({ billCents: 120000, tipCents: 12000, spendableCents: 30000, useCredit: true })).toEqual({
      credit_cents: 30000,
      cash_bill_cents: 90000,
      cash_tip_cents: 12000,
      total_cents: 132000,
      cash_due_cents: 102000,
    });
  });

  it("credit never covers more than the bill, never the tip", () => {
    const s = tabSplit({ billCents: 50000, tipCents: 5000, spendableCents: 90000, useCredit: true });
    expect(s.credit_cents).toBe(50000);
    expect(s.cash_bill_cents).toBe(0);
    expect(s.cash_tip_cents).toBe(5000);
  });

  it("without credit the whole bill is cash", () => {
    const s = tabSplit({ billCents: 10000, tipCents: 0, spendableCents: 30000, useCredit: false });
    expect(s).toMatchObject({ credit_cents: 0, cash_bill_cents: 10000, cash_due_cents: 10000 });
  });

  it("the parts always add up to the bill and the tip", () => {
    for (const bill of [100, 49000, 300050])
      for (const tip of [0, 500, 9000])
        for (const credit of [0, 100, 60000, 999999]) {
          const s = tabSplit({ billCents: bill, tipCents: tip, spendableCents: credit, useCredit: true });
          expect(s.credit_cents + s.cash_bill_cents + s.cash_tip_cents).toBe(s.total_cents);
        }
  });
});
