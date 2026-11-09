// Money (MESITA-3303): the Vouchers tab wears the TestBand while Stripe is in
// test mode, sells only what the server lists, and formats cents without
// arithmetic. A legal/money guard under the MVP test rule, not a layout pin.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TEST_BAND_TEXT } from "../TestBand";
import type { PlaceDetail, PlaceMoney } from "../../place-detail";
import { placeMoneyFrom } from "../../place-to-detail";
import { OffersWalletPill, pesos, VouchersPane } from "./vouchers";

const OFFER: PlaceMoney = {
  charges_enabled: true,
  mesita_pay: true,
  cashback: true,
  vouchers: { voucher_200: true, voucher_1000: true, voucher_5000: true, voucher_welcome: true, voucher_story: false, voucher_vip: false },
  test_mode: true,
  currency: "mxn",
  sell: ["voucher_200", "voucher_1000"],
  unavailable: { voucher_5000: "not_yet", voucher_welcome: "used", voucher_story: "off", voucher_vip: "off" },
  catalog: {
    voucher_200: { price_cents: 20000, bonus_cents: 2000, credit_cents: 22000, available_after_sec: 3600 },
    voucher_1000: { price_cents: 100000, bonus_cents: 20000, credit_cents: 120000, available_after_sec: 3600 },
  },
  balance: { available_cents: 22000, pending_cents: 10000, held_cents: 0, spendable_cents: 22000 },
};

function render(money: PlaceMoney | undefined, onBuyVoucher?: () => void): string {
  return renderToStaticMarkup(<VouchersPane place={{ money, name: "Probe", photos: [] } as unknown as PlaceDetail} actions={onBuyVoucher ? { onBuyVoucher } : undefined} />);
}

describe("Vouchers tab", () => {
  it("shows no test notice on the Offers page, test mode or not (MESITA-3454, Pato's call for now)", () => {
    expect(render(OFFER)).not.toContain(TEST_BAND_TEXT);
    expect(render({ ...OFFER, test_mode: false })).not.toContain(TEST_BAND_TEXT);
  });

  it("offers Buy only on what the server lists in `sell`, and never on a read without it", () => {
    const html = render(OFFER, () => {});
    // Every row for sale is a choice; one button buys the chosen (MESITA-3483).
    expect(html).toContain('aria-label="Choose the Small voucher');
    expect(html).toContain('aria-label="Choose the Mid voucher');
    expect(html).toContain('aria-label="Choose the Big voucher'); // test mode: buyable, the server decides at the tap (MESITA-3342)
    expect(html).not.toContain('aria-label="Choose the Welcome voucher');
    expect(html).toContain("You had yours here");
    // An older read: switches on, no `sell`: nothing for sale.
    const older = placeMoneyFrom({ charges_enabled: true, cashback: true, vouchers: { voucher_200: true } });
    expect(render(older, () => {})).not.toContain("Buy the");
  });

  it("the green mark is the server's; an older read without it keeps the old rule (MESITA-3408)", () => {
    expect(placeMoneyFrom({ charges_enabled: true, mesita_pay: false })?.mesita_pay).toBe(false);
    expect(placeMoneyFrom({ charges_enabled: false, mesita_pay: true })?.mesita_pay).toBe(true);
    expect(placeMoneyFrom({ charges_enabled: true })?.mesita_pay).toBe(true);
    expect(placeMoneyFrom({ charges_enabled: false })?.mesita_pay).toBe(false);
  });

  it("shows the guest's credits from the server's balance on the wallet pill, Available and Pending (MESITA-3483)", () => {
    const pill = (money: PlaceMoney) =>
      renderToStaticMarkup(<OffersWalletPill place={{ money, name: "Probe", photos: [] } as unknown as PlaceDetail} />);
    const html = pill(OFFER);
    expect(html).toContain("Your credits here: MX$220, MX$100 pending");
    expect(pill({ ...OFFER, balance: null })).toContain("MX$0");
  });

  it("formats cents and never adds", () => {
    expect(pesos(22000, "mxn")).toBe("MX$220");
    expect(pesos(120000, "mxn")).toBe("MX$1,200");
    expect(pesos(1050, "mxn")).toBe("MX$10.50");
    expect(render(OFFER)).toContain("Pay MX$1,000, Get MX$1,200");
    expect(render(OFFER)).toContain("30% Bonus");
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
