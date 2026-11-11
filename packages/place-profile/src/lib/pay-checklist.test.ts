// MESITA-3708: the checklist both phones read. Money: the guest must never
// see cash or credit as done before the waiter verified it, nor a card as
// paid while it is still going through.
import { describe, expect, it } from "vitest";
import { payChecklist, verifyLabel } from "./pay-checklist";

const base = {
  billCents: 45000,
  creditCents: 0,
  cardBillCents: 0,
  cardTipCents: 0,
  cashBillCents: 0,
  cashTipCents: 0,
  cardPending: false,
  paid: false,
  verifiedAt: null,
  closed: false,
  side: "guest" as const,
};

const state = (steps: ReturnType<typeof payChecklist>, key: string) => steps.find((s) => s.key === key)?.state;

describe("payChecklist", () => {
  it("holds credit + cash until the waiter verifies", () => {
    const s = payChecklist({ ...base, creditCents: 20000, cashBillCents: 25000 });
    expect(state(s, "credit")).toBe("waiting");
    expect(state(s, "cash")).toBe("waiting");
    expect(state(s, "verified")).toBe("waiting");
    const v = payChecklist({ ...base, creditCents: 20000, cashBillCents: 25000, paid: true, verifiedAt: "2026-11-11T20:00:00Z" });
    expect([state(v, "credit"), state(v, "cash"), state(v, "verified")]).toEqual(["done", "done", "done"]);
  });

  it("never shows a card as paid while it is going through", () => {
    const s = payChecklist({ ...base, creditCents: 5000, cardBillCents: 40000, cardPending: true });
    expect(state(s, "card")).toBe("waiting");
    expect(state(s, "credit")).toBe("waiting");
  });

  it("marks unverified cash as failed once the window closed", () => {
    const s = payChecklist({ ...base, cashBillCents: 45000, closed: true });
    expect(state(s, "cash")).toBe("failed");
    expect(state(s, "verified")).toBe("failed");
  });

  it("names the action on the waiter's button, never the total", () => {
    const money = (c: number) => `MX$${c / 100}`;
    expect(verifyLabel({ cashBillCents: 25000, cashTipCents: 0 }, money)).toBe("Verify · collect MX$250");
    expect(verifyLabel({ cashBillCents: 0, cashTipCents: 0 }, money)).toBe("Verify · paid in the app");
  });
});
