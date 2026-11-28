import { describe, expect, it } from "vitest";

import type { PlaceMoney } from "../place-detail";
import { offerSlides } from "./offers";
import { mesitaRowState, PREPAY_PAUSED } from "./mesita-row";

const BASE: PlaceMoney = {
  charges_enabled: false,
  mesita_pay: false,
  vouchers: { voucher_welcome: false, voucher_200: false, voucher_1000: false, voucher_5000: false, voucher_vip: false },
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
    expect(offerSlides({ sell: [] })).toEqual([]);
  });

  it("orders Pay (cashback) then Prepay, each as a range (MESITA-4702, MESITA-5093)", () => {
    const slides = offerSlides({
      sell: ["voucher_200", "voucher_5000", "voucher_story", "voucher_welcome"],
      cashback_pct: 10,
      cashback_flat: false,
    });
    expect(slides.map((s) => `${s.lead} ${s.pill}`)).toEqual(["Pay 10% Back", "Prepay +10% to +30% Bonus"]);
    expect(slides.map((s) => s.section)).toEqual(["cashback", "prepayment"]);
    expect(slides[1]?.voucher).toBe("voucher_5000");
    // The place's own pick wins (MESITA-4764).
    expect(offerSlides({ sell: ["voucher_200", "voucher_5000"], voucher_pct: { voucher_200: 20, voucher_5000: 60 } })[0]?.pill).toBe("+20% to +60% Bonus");
    // One rate reads alone; no cashback, no Pay slide.
    expect(offerSlides({ sell: [], cashback_pct: 5, cashback_flat: true }).map((s) => s.pill)).toEqual(["5% Back"]);
    expect(offerSlides({ sell: ["voucher_200"], cashback_pct: null }).map((s) => s.lead)).toEqual(["Prepay"]);
    // The place screen's money carries the lines themselves.
    expect(offerSlides({ sell: [], cashback: { welcome_bps: 1000, returning_bps: 500 } }).map((s) => s.pill)).toEqual(["5% to 10% Back"]);
    // A list row's lines: the ones that are on.
    expect(offerSlides({ sell: [], cashback_pct: 20, welcome_pct: 20, returning_pct: 10 }).map((s) => s.pill)).toEqual(["10% to 20% Back"]);
    expect(offerSlides({ sell: [], cashback_pct: 10, welcome_pct: 10, returning_pct: null }).map((s) => s.pill)).toEqual(["10% Back"]);
  });
});

describe("mesitaRowState", () => {
  it("is Off for a place that takes no bookings and offers nothing", () => {
    const s = mesitaRowState({ reservations_enabled: false, money: BASE });
    expect(s.reserve.works).toBe(false);
    expect(s.offers).toEqual({ works: false, loading: false, slides: [] });
  });

  it("works with one slide, and says paused while Mesita pauses sales", () => {
    expect(mesitaRowState({ money: { ...BASE, sell: ["voucher_200"] } }).offers.works).toBe(true);
    const paused = mesitaRowState({ money: { ...BASE, unavailable: { voucher_200: "paused" } } });
    expect(paused.offers).toMatchObject({ works: false, note: PREPAY_PAUSED });
  });

  it("waits quietly while the first read is out", () => {
    expect(mesitaRowState({ money: undefined }, true).offers).toEqual({ works: false, loading: true, slides: [] });
  });
});

// The place screen's Offers box (MESITA-5120): one offer a slide, what you
// do over what you get, with the place's real prices and bonuses.
describe("rowOfferSlides", () => {
  it("reads Pay, then each voucher on sale by price", () => {
    const slides = mesitaRowState({
      money: {
        ...BASE,
        sell: ["voucher_1000", "voucher_200"],
        catalog: {
          voucher_200: { price_cents: 20000, bonus_cents: 2000, credit_cents: 22000, available_after_sec: 3600 },
          voucher_1000: { price_cents: 100000, bonus_cents: 40000, credit_cents: 140000, available_after_sec: 3600 },
        },
        cashback: { welcome_bps: 1000, returning_bps: 500, returning_vip_bps: 0, welcome_vip_bps: 0, line: "returning" },
      },
    }).offers.slides;
    expect(slides.map((s) => `${s.lead} / ${s.pillShort}`)).toEqual([
      "Pay / 5% Cashback",
      "Prepay $200MX / +10% Bonus",
      "Prepay $1,000MX / +40% Bonus",
    ]);
    expect(slides.map((s) => s.voucher ?? null)).toEqual([null, "voucher_200", "voucher_1000"]);
  });
});
