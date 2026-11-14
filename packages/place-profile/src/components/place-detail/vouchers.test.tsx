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
  // Story and VIP are parked (MESITA-3831): off sale, so off the page, for
  // every guest. Their locks (MESITA-3502) come back with them.
  it("lists neither Story nor VIP, even for a VIP guest with Instagram linked (MESITA-3831)", () => {
    const html = renderToStaticMarkup(
      <VouchersPane
        place={{ money: OFFER, name: "Probe", photos: [] } as unknown as PlaceDetail}
        actions={{ onBuyVoucher: () => {}, guest: { vip: true, instagramLinked: true } }}
      />,
    );
    expect(html).not.toContain("VIP voucher");
    expect(html).not.toContain("Story voucher");
    expect(html).toContain('aria-label="Choose the Small voucher');
  });

  it("shows no test notice on the Offers page, test mode or not (MESITA-3454, Pato's call for now)", () => {
    expect(render(OFFER)).not.toContain(TEST_BAND_TEXT);
    expect(render({ ...OFFER, test_mode: false })).not.toContain(TEST_BAND_TEXT);
  });

  it("offers Buy only on what the server lists in `sell`, and never on a read without it", () => {
    const html = render(OFFER, () => {});
    // A row for sale carries a selector; one Buy at the foot (MESITA-3487).
    expect(html).toContain('aria-label="Choose the Small voucher');
    expect(html).toContain('aria-label="Choose the Medium voucher');
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
    expect(html).toContain("Your credits here: $220.00MX, $100.00MX pending");
    expect(pill({ ...OFFER, balance: null })).toContain("$0.00MX");
  });

  it("formats cents and never adds", () => {
    expect(pesos(22000, "mxn")).toBe("$220.00MX");
    expect(pesos(120000, "mxn")).toBe("$1,200.00MX");
    expect(pesos(1050, "mxn")).toBe("$10.50MX");
    expect(render(OFFER)).toContain("Pay $1,000.00MX, Get $1,200.00MX");
    expect(render(OFFER)).toContain("+30%");
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
