// MESITA-4698: Offers › Pay · Cashbacks. No saved row reads the defaults. A
// plain module: business-api.ts is "use server" and may export only async
// functions.

// TWO LINES SINCE MESITA-5072 (Pato, 2026-11-27: VIP now changes only the
// Story Reward, so VIP cashback goes): Welcome (the guest's first paid bill
// here) Off · 10 · 20 %, Returning (every later bill) Off · 5 %, and 10 % only
// where Small's bonus is +20 % (so every voucher bonus beats Returning). The
// VIP fields stay in the record at 0; the server refuses anything else.
// No cap per bill (MESITA-4728).
// Voucher bonuses (MESITA-4764, Big's default 30% since MESITA-4980):
// Small 10 · 20 %, Medium 20 · 40 %, Big 30 · 60 %. TWIN of supabase
// _shared/cashback.ts and money.ts
// VOUCHER_BONUS_STEPS_BPS; the server refuses anything else.
export type CashbackRates = {
  welcome_bps: number;
  returning_bps: number;
  /** Retired (MESITA-5072): always 0. */
  returning_vip_bps: number;
  /** Retired (MESITA-5072): always 0. */
  welcome_vip_bps: number;
  small_bonus_bps: number;
  medium_bonus_bps: number;
  big_bonus_bps: number;
};
export const VISIT_PICKS_BPS = {
  welcome_bps: [0, 1000, 2000],
  returning_bps: [0, 500, 1000],
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
  returning_vip_bps: 0,
  welcome_vip_bps: 0,
  small_bonus_bps: 1000,
  medium_bonus_bps: 2000,
  big_bonus_bps: 3000,
};

/** MESITA-5072: Returning's 10 % step only where Small gives +20 %. */
export function returningPicks(smallBonusBps: number): readonly number[] {
  return VISIT_PICKS_BPS.returning_bps.filter((b) => b !== 1000 || smallBonusBps === 2000);
}

/** The record a save sends: both VIP rates 0, and Returning 10 % down to 5 %
 *  once Small is no longer +20 % (the server refuses the pair). */
export function saveableCashback(r: CashbackRates): CashbackRates {
  return {
    ...r,
    welcome_vip_bps: 0,
    returning_vip_bps: 0,
    returning_bps: returningPicks(r.small_bonus_bps).includes(r.returning_bps) ? r.returning_bps : 500,
  };
}

/** The fields the server saves; anything else it sent (an older server's
 *  story_reward_cents or visit_mechanism) is dropped, and a field it lacks
 *  reads the default. */
export function readCashback(r: Partial<Record<keyof CashbackRates, unknown>>): CashbackRates {
  const out = { ...CASHBACK_DEFAULTS };
  for (const k of Object.keys(out) as Array<keyof CashbackRates>) {
    const v = r[k];
    if (typeof v === "number") out[k] = v;
  }
  return out;
}
