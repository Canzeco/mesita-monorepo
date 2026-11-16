import { describe, expect, it } from "vitest";

import type { PlaceMoney } from "../place-detail";
import { offerSlides } from "./offers";
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
    expect(slides.map((s) => `${s.lead} ${s.pill}`)).toEqual(["Welcome +100%", "VIP +100%", "Pay 7% Back", "Prepay +20%"]);
    expect(slides.map((s) => s.section)).toEqual(["special", "special", null, "prepayment"]);
  });
});

describe("mesitaRowState", () => {
  it("is Off for a place that takes no bookings and offers nothing", () => {
    const s = mesitaRowState({ reservations_enabled: false, money: BASE });
    expect(s.reserve.works).toBe(false);
    expect(s.offers).toEqual({ works: false, loading: false, slides: [] });
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
