// Money (MESITA-3303): while Stripe is in test mode every money surface
// wears the one TestBand, so a guest never reads a test balance as money.
// A legal/money guard under the MVP test rule, not a layout pin.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "../..");
const WALLET = readFileSync(join(SRC, "components", "consumer", "wallet", "WalletPage.tsx"), "utf8");
const PAY = readFileSync(join(SRC, "components", "consumer", "pay", "PayPage.tsx"), "utf8");

describe("Wallet in test mode", () => {
  it("renders the TestBand from the server's test_mode flag", () => {
    expect(WALLET).toContain('import { TestBand } from "@mesita/place-profile"');
    expect(WALLET).toMatch(/wallet\?\.test_mode \? <TestBand/);
  });

  it("never computes a balance: every amount shown is a server field", () => {
    expect(WALLET).not.toMatch(/balance_cents\s*[+-]/);
    expect(WALLET).not.toMatch(/available_cents\s*[+-]/);
  });
});

// MESITA-3304: the Pay tab spends credit; its form and its proof both wear
// the band from the server's flag, and it never adds money up either.
describe("Pay in test mode", () => {
  it("renders the TestBand on the list, the form and the proof", () => {
    expect(PAY).toMatch(/import \{[^}]*\bTestBand\b[^}]*\} from "@mesita\/place-profile"/);
    expect(PAY).toMatch(/testMode \? <TestBand/);
    expect(PAY).toMatch(/place\.test_mode \? <TestBand/);
    expect(PAY).toMatch(/proof\.test_mode \? <TestBand/);
  });

  it("never computes a balance: spendable is a server field", () => {
    expect(PAY).not.toMatch(/(spendable|available|balance)_cents\s*[+-]/);
  });
});
