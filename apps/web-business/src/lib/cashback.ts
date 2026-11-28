// MESITA-4698: Offers › Pay · Cashbacks. No saved row reads the defaults. A
// plain module: business-api.ts is "use server" and may export only async
// functions.

// ONE LINE SINCE MESITA-5124 (Pato, 2026-11-28: "Just one cashback. and the
// welcome thing is the voucher, not the visit"): Cashback, every bill, the
// first here like every later one, Off · 5 %, and 10 % only where Small's
// bonus is +20 % (so every voucher bonus beats it). It is stored as
// `returning_bps` (a renamed key resets live config). `welcome_bps` and the
// VIP fields stay in the record at 0; every save writes 0. Two lines, Welcome
// and Returning, from MESITA-5072. No cap per bill (MESITA-4728).
// Voucher bonuses (MESITA-4764, Big's default 30% since MESITA-4980):
// Welcome 30 · 60 % (MESITA-5124, one per guest per place), Small 10 · 20 %,
// Medium 20 · 40 %, Big 30 · 60 %. TWIN of supabase
// _shared/cashback.ts and money.ts
// VOUCHER_BONUS_STEPS_BPS; the server refuses anything else.
export type CashbackRates = {
  /** Retired (MESITA-5124): always 0. */
  welcome_bps: number;
  /** The one Cashback rate, every bill (MESITA-5124). */
  returning_bps: number;
  /** Retired (MESITA-5072): always 0. */
  returning_vip_bps: number;
  /** Retired (MESITA-5072): always 0. */
  welcome_vip_bps: number;
  small_bonus_bps: number;
  medium_bonus_bps: number;
  big_bonus_bps: number;
  /** MESITA-5124: the Welcome voucher's bonus. */
  welcome_bonus_bps: number;
};
export const VISIT_PICKS_BPS = {
  returning_bps: [0, 500, 1000],
} as const;
export type VisitRateField = keyof typeof VISIT_PICKS_BPS;
export const VOUCHER_BONUS_PICKS_BPS = {
  welcome_bonus_bps: [3000, 6000],
  small_bonus_bps: [1000, 2000],
  medium_bonus_bps: [2000, 4000],
  big_bonus_bps: [3000, 6000],
} as const;
export type VoucherBonusField = keyof typeof VOUCHER_BONUS_PICKS_BPS;
export const CASHBACK_DEFAULTS: CashbackRates = {
  welcome_bps: 0,
  returning_bps: 500,
  returning_vip_bps: 0,
  welcome_vip_bps: 0,
  small_bonus_bps: 1000,
  medium_bonus_bps: 2000,
  big_bonus_bps: 3000,
  welcome_bonus_bps: 3000,
};

/** MESITA-5072: Cashback's 10 % step only where Small gives +20 %. */
export function returningPicks(smallBonusBps: number): readonly number[] {
  return VISIT_PICKS_BPS.returning_bps.filter((b) => b !== 1000 || smallBonusBps === 2000);
}

/** The record a save sends: Welcome and both VIP rates 0, and Cashback 10 %
 *  down to 5 % once Small is no longer +20 % (the server refuses the pair). */
export function saveableCashback(r: CashbackRates): CashbackRates {
  return {
    ...r,
    welcome_bps: 0,
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
