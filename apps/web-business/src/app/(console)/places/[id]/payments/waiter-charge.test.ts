// Money (MESITA-3306; Cash Payments since MESITA-3589): the waiter confirms a
// bill paid outside with the place code, so Cash Payments cannot turn on
// without it and the page says so from the server's code_set. House Credits
// and Mesita Payments are never gated on the code.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PANEL = readFileSync(join(__dirname, "PaymentsPanel.tsx"), "utf8");

describe("the place code on Payments", () => {
  it("blocks Cash Payments without a place code, says how to set it, and links the waiter's screen once it is", () => {
    expect(PANEL).toMatch(/code_set: codeSet/);
    expect(PANEL).toContain("Set a place code on Settings first");
    expect(PANEL).toMatch(/blocked: codeSet \? undefined : needsCode/);
    expect(PANEL).toContain("/charge/${encodeURIComponent(placeId)}");
  });

  it("never gates House Credits or Mesita Pay on the place code", () => {
    const hc = PANEL.slice(PANEL.indexOf('key: "house_credits"'), PANEL.indexOf('key: "cash_payments"'));
    const mp = PANEL.slice(PANEL.indexOf('key: "pay_cards"'), PANEL.indexOf('key: "card_cashback_bps"'));
    expect(hc).not.toMatch(/codeSet/);
    expect(mp).not.toMatch(/codeSet/);
  });
});
