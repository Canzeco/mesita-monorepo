// Money (MESITA-3303): the Vouchers tab wears the TestBand while Stripe is in
// test mode, sells only what the server lists, and formats cents without
// arithmetic. A legal/money guard under the MVP test rule, not a layout pin.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TEST_BAND_TEXT } from "../TestBand";
import type { PlaceDetail, PlaceMoney } from "../../place-detail";
import { placeMoneyFrom } from "../../place-to-detail";
import { pesos, readyClock, VouchersPane } from "./vouchers";

const OFFER: PlaceMoney = {
  charges_enabled: true,
  mesita_pay: true,
  vouchers: { voucher_200: true, voucher_1000: true, voucher_5000: true, voucher_story: false, voucher_vip: false },
  test_mode: true,
  currency: "mxn",
  sell: ["voucher_200", "voucher_1000"],
  unavailable: { voucher_5000: "not_yet" },
  catalog: {
    voucher_200: { price_cents: 20000, bonus_cents: 2000, credit_cents: 22000, available_after_sec: 3600 },
    voucher_1000: { price_cents: 100000, bonus_cents: 20000, credit_cents: 120000, available_after_sec: 3600 },
  },
  balance: { available_cents: 22000, pending_cents: 10000, held_cents: 0, spendable_cents: 22000 },
};

// A server that still sells the retired Story key (MESITA-4641); every other line as OFFER.
const STALE_SELL: PlaceMoney = {
  ...OFFER,
  test_mode: false,
  vouchers: { ...OFFER.vouchers, voucher_story: true, voucher_vip: false },
  sell: ["voucher_200", "voucher_1000", "voucher_story"],
  unavailable: { voucher_5000: "not_yet" },
};

function render(money: PlaceMoney | undefined, onBuyVoucher?: () => void): string {
  return renderToStaticMarkup(<VouchersPane place={{ money, name: "Probe", photos: [] } as unknown as PlaceDetail} actions={onBuyVoucher ? { onBuyVoucher } : undefined} />);
}

describe("Vouchers tab", () => {
  // Stories are gone (MESITA-4641): no row even while the server still sells the key.
  it("never lists the retired Story voucher, nor a VIP the place doesn't sell", () => {
    const html = renderToStaticMarkup(
      <VouchersPane
        place={{ money: STALE_SELL, name: "Probe", photos: [] } as unknown as PlaceDetail}
        actions={{ onBuyVoucher: () => {}, guest: { instagramLinked: true } }}
      />,
    );
    expect(html).not.toContain('data-voucher="voucher_story"');
    expect(html).not.toContain('data-voucher="voucher_vip"');
    expect(row(html, "voucher_200")).not.toContain("data-voucher-locked");
  });

  it("shows no test notice on the Offers page, test mode or not (MESITA-3454, Pato's call for now)", () => {
    expect(render(OFFER)).not.toContain(TEST_BAND_TEXT);
    expect(render({ ...OFFER, test_mode: false })).not.toContain(TEST_BAND_TEXT);
  });

  // HIDDEN · BLOCKED · AVAILABLE (MESITA-4603): what the place doesn't offer
  // is not on the page (no Welcome at all since MESITA-4636).
  it("hides what the place doesn't offer and any Welcome; Buy only on `sell`", () => {
    const html = render({ ...OFFER, test_mode: false }, () => {});
    expect(row(html, "voucher_200")).not.toContain("data-voucher-locked");
    expect(row(html, "voucher_1000")).not.toContain("data-voucher-locked");
    expect(html).not.toContain('data-voucher="voucher_5000"');
    expect(html).not.toContain('data-voucher="voucher_welcome"');
    // An older read: switches on, no `sell`: nothing for sale, nothing shown.
    const older = render({ ...placeMoneyFrom({ charges_enabled: true, vouchers: { voucher_200: true } })!, test_mode: false }, () => {});
    expect(older).not.toContain("data-voucher=");
    // Test mode too (MESITA-4399): a row the server does not sell never shows.
    const test = render(OFFER, () => {});
    expect(row(test, "voucher_1000")).not.toContain("data-voucher-locked");
    expect(test).not.toContain('data-voucher="voucher_5000"');
    // A paused sale is not the place's: the row stays, blocked.
    const paused = render({ ...OFFER, sell: ["voucher_1000"], unavailable: { ...OFFER.unavailable, voucher_200: "paused" } }, () => {});
    expect(row(paused, "voucher_200")).toContain("data-voucher-locked");
  });

  it("the green mark is the server's; an older read without it keeps the old rule (MESITA-3408)", () => {
    expect(placeMoneyFrom({ charges_enabled: true, mesita_pay: false })?.mesita_pay).toBe(false);
    expect(placeMoneyFrom({ charges_enabled: false, mesita_pay: true })?.mesita_pay).toBe(true);
    expect(placeMoneyFrom({ charges_enabled: true })?.mesita_pay).toBe(true);
    expect(placeMoneyFrom({ charges_enabled: false })?.mesita_pay).toBe(false);
  });

  it("formats cents and never adds", () => {
    expect(pesos(22000, "mxn")).toBe("$220.00MX");
    expect(pesos(120000, "mxn")).toBe("$1,200.00MX");
    expect(pesos(1050, "mxn")).toBe("$10.50MX");
    expect(row(render(OFFER), "voucher_1000").replace(/<[^>]+>/g, "")).toContain("Pay $1,000 · Get $1,200");
    expect(row(render(OFFER), "voucher_1000")).toContain("+20%");
  });

  it("the pending time is the server's; a bad one is no time (MESITA-4224)", () => {
    const at = "2026-11-17T18:40:00.000Z";
    expect(placeMoneyFrom({ balance: { pending_cents: 100, next_ready_at: at } })?.balance?.next_ready_at).toBe(at);
    expect(placeMoneyFrom({ balance: { pending_cents: 100, next_ready_at: "soon" } })?.balance?.next_ready_at).toBeNull();
    expect(readyClock("nope")).toBe("");
  });
});

/** One row's markup, by its voucher key. */
function row(html: string, key: string): string {
  const start = html.indexOf(`data-voucher="${key}"`);
  expect(start).toBeGreaterThan(-1);
  const end = html.indexOf("</li>", start);
  return html.slice(start, end);
}

describe("placeMoneyFrom", () => {
  it("reads the offer, the catalog and the balance; a bad line is dropped", () => {
    const m = placeMoneyFrom({
      charges_enabled: true,
      test_mode: true,
      currency: "mxn",
      vouchers: { voucher_200: true, voucher_vip: true },
      sell: ["voucher_200", "bogus"],
      unavailable: { voucher_vip: "needs_visit" },
      catalog: {
        voucher_200: { price_cents: 20000, bonus_cents: 2000, credit_cents: 22000, available_after_sec: 3600 },
        voucher_vip: { price_cents: "100" },
      },
      balance: { available_cents: 22000, pending_cents: 0, held_cents: 0, spendable_cents: 22000 },
    });
    expect(m?.sell).toEqual(["voucher_200"]);
    expect(m?.unavailable).toEqual({ voucher_vip: "needs_visit" });
    expect(m?.catalog.voucher_200?.credit_cents).toBe(22000);
    expect(m?.catalog.voucher_vip).toBeUndefined();
    expect(m?.balance?.available_cents).toBe(22000);
    expect(m?.test_mode).toBe(true);
    expect(m?.vouchers.voucher_1000).toBe(false);
  });

  it("reads an older EF's money as nothing for sale", () => {
    const m = placeMoneyFrom({ charges_enabled: true, vouchers: { voucher_200: true } });
    expect(m?.sell).toEqual([]);
    expect(m?.balance).toBeNull();
    expect(m?.test_mode).toBe(false);
    expect(placeMoneyFrom(null)).toBeUndefined();
  });
});
