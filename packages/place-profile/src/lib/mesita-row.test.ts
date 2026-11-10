import { describe, expect, it } from "vitest";

import type { PlaceMoney } from "../place-detail";
import { mesitaRowState } from "./mesita-row";

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

// Money promises (MESITA-3581): a tile is green only when it works here, with
// the place's real numbers, never a promise the place cannot keep.
describe("mesitaRowState", () => {
  it("says Off for everything a place does not run, and never $0MX", () => {
    const s = mesitaRowState({ reservations_enabled: false, money: BASE });
    expect(s).toEqual({
      reserve: { works: false, pill: "Off" },
      prepay: { works: false, pill: "Off" },
      wallet: { works: false, pill: "Off" },
      pay: { works: false, pill: "Off" },
    });
  });

  it("reads the best bonus from what sells, the balance, and the cash rate", () => {
    const s = mesitaRowState({
      money: {
        ...BASE,
        charges_enabled: true,
        outside_cashback: true,
        cash_cashback_bps: 300,
        sell: ["voucher_200", "voucher_1000"],
        catalog: {
          voucher_200: { price_cents: 20000, bonus_cents: 2000, credit_cents: 22000, available_after_sec: 0 },
          voucher_1000: { price_cents: 100000, bonus_cents: 20000, credit_cents: 120000, available_after_sec: 0 },
          voucher_5000: { price_cents: 500000, bonus_cents: 150000, credit_cents: 650000, available_after_sec: 0 },
        },
        balance: { available_cents: 12000, pending_cents: 0, held_cents: 0, spendable_cents: 12000 },
      },
    });
    expect(s.prepay).toEqual({ works: true, pill: "20% Bonus" });
    expect(s.wallet).toEqual({ works: true, pill: "$120MX" });
    // The place's own rates (MESITA-3589), never a typed-in 5% / 2%.
    expect(s.pay).toEqual({ works: true, pill: "3% Back" });
    expect(mesitaRowState({ money: { ...BASE, cashback: true, card_cashback_bps: 700, outside_cashback: true, cash_cashback_bps: 300 } }).pay.pill).toBe("7% Back");
    // An older read without the rate says On, never a guessed number.
    expect(mesitaRowState({ money: { ...BASE, charges_enabled: true, cashback: true } }).pay.pill).toBe("On");
  });
});
