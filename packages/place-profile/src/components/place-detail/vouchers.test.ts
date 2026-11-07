// Money (MESITA-3303): the Vouchers tab wears the TestBand while Stripe is in
// test mode, sells only what the server lists, and formats cents without
// arithmetic. A legal/money guard under the MVP test rule, not a layout pin.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { placeMoneyFrom } from "../../place-to-detail";
import { pesos } from "./vouchers";

const SRC = readFileSync(join(__dirname, "vouchers.tsx"), "utf8");

describe("Vouchers tab in test mode", () => {
  it("renders the TestBand from the server's test_mode flag", () => {
    expect(SRC).toContain('import { TestBand } from "../TestBand"');
    expect(SRC).toMatch(/money\.test_mode \? <TestBand/);
  });

  it("offers Buy only on what the server lists in `sell`", () => {
    expect(SRC).toContain("const forSale = money.sell.includes(k)");
    expect(SRC).toMatch(/\{forSale \? \(\s*<button/);
  });

  it("formats cents and never adds price to bonus", () => {
    expect(SRC).not.toMatch(/price_cents\s*\+/);
    expect(pesos(22000, "mxn")).toBe("MX$220");
    expect(pesos(120000, "mxn")).toBe("MX$1,200");
    expect(pesos(1050, "mxn")).toBe("MX$10.50");
  });
});

describe("placeMoneyFrom", () => {
  it("reads the offer, the catalog and the balance; a bad line is dropped", () => {
    const m = placeMoneyFrom({
      charges_enabled: true,
      cashback: true,
      test_mode: true,
      currency: "mxn",
      vouchers: { voucher_200: true, voucher_welcome: true },
      sell: ["voucher_200", "bogus"],
      unavailable: { voucher_welcome: "used" },
      catalog: {
        voucher_200: { price_cents: 20000, bonus_cents: 2000, credit_cents: 22000, available_after_sec: 3600 },
        voucher_welcome: { price_cents: "100" },
      },
      balance: { available_cents: 22000, pending_cents: 0, held_cents: 0, spendable_cents: 22000 },
    });
    expect(m?.sell).toEqual(["voucher_200"]);
    expect(m?.unavailable).toEqual({ voucher_welcome: "used" });
    expect(m?.catalog.voucher_200?.credit_cents).toBe(22000);
    expect(m?.catalog.voucher_welcome).toBeUndefined();
    expect(m?.balance?.available_cents).toBe(22000);
    expect(m?.test_mode).toBe(true);
    expect(m?.vouchers.voucher_1000).toBe(false);
  });

  it("reads an older EF's money as nothing for sale", () => {
    const m = placeMoneyFrom({ charges_enabled: true, cashback: false, vouchers: { voucher_200: true } });
    expect(m?.sell).toEqual([]);
    expect(m?.balance).toBeNull();
    expect(m?.test_mode).toBe(false);
    expect(placeMoneyFrom(null)).toBeUndefined();
  });
});
