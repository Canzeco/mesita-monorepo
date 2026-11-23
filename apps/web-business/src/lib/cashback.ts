// MESITA-4698: Offers › Stage 1 · Cashbacks. Each rate is Off · 5 · 10 · 15 ·
// 20 %; no saved row reads the defaults. A plain module: business-api.ts is
// "use server" and may export only async functions.

// Two lines since MESITA-4709: Welcome (the guest's first paid bill here) and
// Returning (every later bill).
// MESITA-4714: and Post, what a verified Instagram story pays the guest:
// Off · 20 · 50 (cents 0 · 2000 · 5000), only while Loyalty Cards is On.
export type CashbackRates = { welcome_bps: number; returning_bps: number; cap_cents: number; story_reward_cents: number };
export const CASHBACK_STEPS_BPS = [0, 500, 1000, 1500, 2000] as const;
export const STORY_REWARD_STEPS_CENTS = [0, 2000, 5000] as const;
export const CASHBACK_DEFAULTS: CashbackRates = { welcome_bps: 1000, returning_bps: 500, cap_cents: 20000, story_reward_cents: 2000 };

/** A read from before Post carries no story reward: the default. */
export function withStoryReward(r: Partial<CashbackRates> & Omit<CashbackRates, "story_reward_cents">): CashbackRates {
  return { ...r, story_reward_cents: typeof r.story_reward_cents === "number" ? r.story_reward_cents : CASHBACK_DEFAULTS.story_reward_cents };
}
