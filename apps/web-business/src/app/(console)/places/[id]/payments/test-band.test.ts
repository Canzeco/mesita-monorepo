// Money (MESITA-3303): while Stripe is in test mode Business › Payments wears
// the one TestBand, so an owner never reads a test sale as money. A
// legal/money guard under the MVP test rule, not a layout pin.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PANEL = readFileSync(join(__dirname, "PaymentsPanel.tsx"), "utf8");

describe("Payments in test mode", () => {
  it("renders the TestBand from the server's test_mode flag", () => {
    expect(PANEL).toMatch(/import \{[^}]*TestBand[^}]*\} from "@mesita\/place-profile"/);
    expect(PANEL).toMatch(/testMode \? <TestBand/);
  });

  it("tells which switched-on vouchers are not for sale by the shared money rule", () => {
    expect(PANEL).toContain("moneyState(settings, { charges_enabled: account.charges_enabled }, null)");
  });
});
