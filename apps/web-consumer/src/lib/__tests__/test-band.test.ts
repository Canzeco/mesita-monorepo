// Money (MESITA-3303): while Stripe is in test mode every money surface
// wears the one TestBand, so a guest never reads a test balance as money.
// A legal/money guard under the MVP test rule, not a layout pin.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "../..");
const read = (...path: string[]) => readFileSync(join(SRC, "components", "consumer", ...path), "utf8");
// The Wallet's rails, drawn under Pay since MESITA-3631.
const WALLET = read("wallet", "WalletSection.tsx");
// A place's House Card, /wallet/<placeId> (MESITA-3614).
const HOUSE_CARD = read("wallet", "WalletPlaceScreen.tsx");
// Pay is a screen per address since MESITA-3614: the list, the form, the proof.
const PAY_LIST = read("pay", "PayPage.tsx");
const PAY_FORM = read("pay", "PayForm.tsx");
const PAY_PROOF = read("pay", "ProofView.tsx");
const PAY = [PAY_LIST, PAY_FORM, PAY_PROOF].join("\n");

describe("Wallet in test mode", () => {
  it("renders the TestBand from the server's test_mode flag, on the rails and on a House Card", () => {
    for (const src of [WALLET, HOUSE_CARD]) {
      expect(src).toContain('import { TestBand } from "@mesita/place-profile"');
    }
    expect(HOUSE_CARD).toMatch(/wallet\?\.test_mode \? <TestBand/);
    // Under Pay the rails skip their band only when Pay's list already
    // shows one (never two, never none).
    expect(WALLET).toMatch(/wallet\?\.test_mode && !testBandShown \? <TestBand/);
    expect(PAY_LIST).toMatch(/testBandShown=\{!!places\?\.some\(\(p\) => p\.test_mode\)\}/);
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
    for (const src of [PAY_LIST, PAY_FORM, PAY_PROOF]) {
      expect(src).toMatch(/import \{[^}]*\bTestBand\b[^}]*\} from "@mesita\/place-profile"/);
    }
    expect(PAY_LIST).toMatch(/testMode \? <TestBand/);
    expect(PAY_FORM).toMatch(/place\.test_mode \? <TestBand/);
    expect(PAY_PROOF).toMatch(/proof\.test_mode \? <TestBand/);
  });

  it("never computes a balance: spendable is a server field", () => {
    expect(PAY).not.toMatch(/(spendable|available|balance)_cents\s*[+-]/);
  });
});
