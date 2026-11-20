// Money (MESITA-3306; MESITA-4485): Cash Payments is a switch. It does not
// wait on a waiter code, and this page has no control for accepting codes.
// Loyalty Cards and App Payments are not gated on a code either.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PANEL = readFileSync(join(__dirname, "PaymentsPanel.tsx"), "utf8");

describe("the place code on Payments", () => {
  it("does not gate Cash Payments on a waiter code, and links the waiter's screen", () => {
    expect(PANEL).not.toContain("<WaiterCodeRow");
    expect(PANEL).not.toContain("Set the waiter code first.");
    expect(PANEL).toContain('accept: { key: "cash_payments" }');
    expect(PANEL).toContain("/charge/${encodeURIComponent(placeId)}");
  });

  it("never gates Loyalty Cards or App Payments on the place code", () => {
    const hc = PANEL.slice(PANEL.indexOf('key: "loyalty_cards"'), PANEL.indexOf('key: "cash_payments"'));
    const mp = PANEL.slice(PANEL.indexOf('key: "pay_cards"'), PANEL.indexOf('id: "credits-payments"'));
    expect(hc).not.toMatch(/codeSet/);
    expect(mp).not.toMatch(/codeSet/);
  });
});
