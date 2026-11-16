import { describe, expect, it } from "vitest";

import type { PlaceMoney } from "../place-detail";
import { offerDetailSlides, offerSlides } from "./offers";
import { mesitaRowState, PREPAY_PAUSED } from "./mesita-row";

const BASE: PlaceMoney = {
  charges_enabled: false,
  mesita_pay: false,
  cashback: false,
  outside_cashback: false,
  vouchers: { voucher_200: false, voucher_1000: false, voucher_5000: false, voucher_welcome: false, voucher_story: false, voucher_vip: false },
  test_mode: true,
  currency: "mxn",
  sell: [],
  unavailable: {},
  catalog: {},
  balance: { available_cents: 0, pending_cents: 0, held_cents: 0, spendable_cents: 0 },
};

// Money promises (MESITA-3581, MESITA-4151): an offer shows only when the
// place runs it, with the place's real rate, never a typed-in promise.
describe("offerSlides", () => {
  it("shows nothing for a place that runs nothing", () => {
    expect(offerSlides(null)).toEqual([]);
    expect(offerSlides({ cashback: false, sell: [] })).toEqual([]);
    // Cashback on but no rate in the answer: no guessed number.
    expect(offerSlides({ cashback: true, sell: [] })).toEqual([]);
  });

  it("orders Welcome, Story, VIP, Pay, Prepay and shows only the best standard bonus", () => {
    const slides = offerSlides({
      cashback: true,
      card_cashback_bps: 700,
      sell: ["voucher_200", "voucher_5000", "voucher_vip", "voucher_welcome"],
    });
    expect(slides.map((s) => `${s.lead} ${s.pill}`)).toEqual(["Welcome +100%", "VIP +100%", "Pay 7% Back", "Prepay +30%"]);
    expect(slides.map((s) => s.section)).toEqual(["special", "special", null, "prepayment"]);
  });
});

describe("mesitaRowState", () => {
  it("is Off for a place that takes no bookings and offers nothing", () => {
    const s = mesitaRowState({ reservations_enabled: false, money: BASE });
    expect(s.reserve.works).toBe(false);
    expect(s.offers).toEqual({ works: false, loading: false, slides: [] });
  });

  it("says each offer whole, sizes first, then the specials, then cashback (MESITA-4155)", () => {
    const line = (price: number, credit: number) => ({ price_cents: price, bonus_cents: credit - price, credit_cents: credit, available_after_sec: 3600 });
    const slides = offerDetailSlides({
      ...BASE,
      cashback: true,
      card_cashback_bps: 500,
      outside_cashback: true,
      cash_cashback_bps: 200,
      sell: ["voucher_vip", "voucher_5000", "voucher_200", "voucher_welcome"],
      catalog: { voucher_200: line(20000, 22000), voucher_5000: line(500000, 650000), voucher_welcome: line(10000, 20000), voucher_vip: line(10000, 20000) },
    });
    expect(slides.map((s) => s.pill)).toEqual(["+10% Bonus", "+30% Bonus", "+100% Bonus", "+100% Bonus", "5% Cashback", "2% Cash Back"]);
    expect(slides.map((s) => s.spoken)).toEqual([
      "Prepay $200MX, get 10% bonus",
      "Prepay $5000MX, get 30% bonus",
      "Prepay $100MX, get 100% bonus",
      "Prepay $100MX, get 100% bonus",
      "Pay with Mesita, get 5% cashback",
      "Pay with cash, get 2% back",
    ]);
    expect(slides.map((s) => s.section)).toEqual(["prepayment", "prepayment", "special", "special", null, null]);
    // On sale but no catalog line: no guessed amount.
    expect(offerDetailSlides({ ...BASE, sell: ["voucher_1000"] })).toEqual([]);
  });

  it("works with one slide, and says paused while Mesita pauses sales", () => {
    expect(mesitaRowState({ money: { ...BASE, cashback: true, card_cashback_bps: 500 } }).offers.works).toBe(true);
    const paused = mesitaRowState({ money: { ...BASE, unavailable: { voucher_200: "paused" } } });
    expect(paused.offers).toMatchObject({ works: false, note: PREPAY_PAUSED });
  });

  it("waits quietly while the first read is out", () => {
    expect(mesitaRowState({ money: undefined }, true).offers).toEqual({ works: false, loading: true, slides: [] });
  });
});
