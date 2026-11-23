// MESITA-4698: Offers › Stage 1 · Cashbacks. Each rate is Off · 5 · 10 · 15 ·
// 20 %; no saved row reads the defaults. A plain module: business-api.ts is
// "use server" and may export only async functions.

// Two lines since MESITA-4709: Welcome (the guest's first paid bill here) and
// Returning (every later bill).
// MESITA-4714: and Post, what a verified Instagram story pays the guest:
// Off · 20 · 50 (cents 0 · 2000 · 5000), only while Loyalty Cards is On.
// No cap per bill (Pato, 2026-11-23, MESITA-4728: "there is no ceiling for the
// cashback amount").
// TWO PICKS PER OFFER (Pato, 2026-11-23, MESITA-4764): Welcome 10 · 20 %,
// Returning 5 · 10 %, Small voucher 10 · 20 %, Medium 20 · 40 %, Big 40 · 60 %,
// Story MX$20 · MX$40. TWIN of supabase _shared/cashback.ts and money.ts
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
  visit_mechanism: VisitMechanism;
  story_reward_cents: number;
  small_bonus_bps: number;
  medium_bonus_bps: number;
  big_bonus_bps: number;
};
export const VISIT_PICKS_BPS = { welcome_bps: [1000, 2000], returning_bps: [500, 1000] } as const;
export const STORY_REWARD_STEPS_CENTS = [0, 2000, 4000] as const;
export const VOUCHER_BONUS_PICKS_BPS = {
  small_bonus_bps: [1000, 2000],
  medium_bonus_bps: [2000, 4000],
  big_bonus_bps: [4000, 6000],
} as const;
export type VoucherBonusField = keyof typeof VOUCHER_BONUS_PICKS_BPS;
export const CASHBACK_DEFAULTS: CashbackRates = {
  welcome_bps: 1000,
  returning_bps: 500,
  visit_mechanism: "cashback",
  story_reward_cents: 2000,
  small_bonus_bps: 1000,
  medium_bonus_bps: 2000,
  big_bonus_bps: 4000,
};

/** A read from an older server lacks the story reward or the voucher
 *  bonuses: the defaults fill them. */
export function withStoryReward(r: Partial<CashbackRates> & Pick<CashbackRates, "welcome_bps" | "returning_bps">): CashbackRates {
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
