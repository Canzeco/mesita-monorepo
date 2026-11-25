// MESITA-4698: Offers › Pay · Cashbacks. No saved row reads the defaults. A
// plain module: business-api.ts is "use server" and may export only async
// functions.

// FOUR LINES SINCE MESITA-4789 (Pato: "Welcome Regular, Returning Regular,
// Welcome VIP, Returning VIP"): Welcome VIP is a VIP's first bill, Off · 10 ·
// 20 %. THREE LINES SINCE MESITA-4766 (Pato, 2026-11-23: "BRING BACK VIP CUSTOMERS.
// REMOVE INSTAGRAM STORIES."): Welcome Everyone (the guest's first paid bill
// here) Off · 10 · 20 %, Returning Regular (every later bill) Off · 5 · 10 %,
// Returning VIP (every later bill of a VIP guest: invitation code,
// MESITA-4849) Off · 10 · 20 %. No cap per bill (MESITA-4728).
// Voucher bonuses (MESITA-4764, Big's default 30% since MESITA-4980):
// Small 10 · 20 %, Medium 20 · 40 %, Big 30 · 60 %. TWIN of supabase
// _shared/cashback.ts and money.ts
// VOUCHER_BONUS_STEPS_BPS; the server refuses anything else.
/** MESITA-4770: how the Welcome / Returning lines pay out (Pato,
 *  2026-11-23: "YOU JUST SET THE TIER. AND THEN THE MECHANISM FOR ALL YOUR
 *  VISIT TIERS"). Discount = off this bill, no Credits Agreement; Cashback =
 *  credit for the next visit, needs Loyalty Cards. */
export type VisitMechanism = "discount" | "cashback";
export const VISIT_MECHANISMS: readonly VisitMechanism[] = ["discount", "cashback"];
export type CashbackRates = {
  welcome_bps: number;
  returning_bps: number;
  returning_vip_bps: number;
  /** MESITA-4789: Welcome VIP, a VIP guest's first paid bill here. */
  welcome_vip_bps: number;
  visit_mechanism: VisitMechanism;
  small_bonus_bps: number;
  medium_bonus_bps: number;
  big_bonus_bps: number;
};
export const VISIT_PICKS_BPS = {
  welcome_bps: [0, 1000, 2000],
  returning_bps: [0, 500, 1000],
  returning_vip_bps: [0, 1000, 2000],
  welcome_vip_bps: [0, 1000, 2000],
} as const;
export type VisitRateField = keyof typeof VISIT_PICKS_BPS;
export const VOUCHER_BONUS_PICKS_BPS = {
  small_bonus_bps: [1000, 2000],
  medium_bonus_bps: [2000, 4000],
  big_bonus_bps: [3000, 6000],
} as const;
export type VoucherBonusField = keyof typeof VOUCHER_BONUS_PICKS_BPS;
export const CASHBACK_DEFAULTS: CashbackRates = {
  welcome_bps: 1000,
  returning_bps: 500,
  returning_vip_bps: 1000,
  welcome_vip_bps: 1000,
  visit_mechanism: "cashback",
  small_bonus_bps: 1000,
  medium_bonus_bps: 2000,
  big_bonus_bps: 3000,
};

/** The fields the server saves; anything else it sent (an older server's
 *  story_reward_cents) is dropped, and a field it lacks reads the default. */
export function readCashback(r: Partial<Record<keyof CashbackRates, unknown>>): CashbackRates {
  const out = { ...CASHBACK_DEFAULTS };
  for (const k of Object.keys(out) as Array<keyof CashbackRates>) {
    const v = r[k];
    if (k === "visit_mechanism") {
      if (v === "discount" || v === "cashback") out.visit_mechanism = v;
    } else if (typeof v === "number") {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}
