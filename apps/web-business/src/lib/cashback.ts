// MESITA-4698: Offers › Stage 1 · Cashbacks. Each rate is Off · 5 · 10 · 15 ·
// 20 %; no saved row reads the defaults. A plain module: business-api.ts is
// "use server" and may export only async functions.

// Two lines since MESITA-4709: Welcome (the guest's first paid bill here) and
// Returning (every later bill).
export type CashbackRates = { welcome_bps: number; returning_bps: number; cap_cents: number };
export const CASHBACK_STEPS_BPS = [0, 500, 1000, 1500, 2000] as const;
export const CASHBACK_DEFAULTS: CashbackRates = { welcome_bps: 1000, returning_bps: 500, cap_cents: 20000 };
