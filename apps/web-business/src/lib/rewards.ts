// The money rules of a Member Visit, in one place. Every screen that shows a
// discount, a cashback, a tip or a prepayment's credit computes it here, so
// the mock data and (later) the Edge Functions agree on one arithmetic.

export type RewardId =
  | "google-review"
  | "instagram-story"
  | "vip-class"
  | "loyalty"
  | "welcome";

/** Discount comes off today's bill; Cashback lands in the guest's Credits. */
export type RewardMode = "discount" | "cashback";

export type RewardRule = {
  id: RewardId;
  name: string;
  requirement: string;
  enabled: boolean;
  /** Whole percent of the bill, 0–100. */
  percent: number;
  mode: RewardMode;
};

/** A guest uses at most this many rewards on one visit. Fixed, not a setting. */
export const MAX_REWARDS_PER_VISIT = 2;
/** Default most a visit's rewards can be worth, in pesos. Each place can change it. */
export const DEFAULT_CAP_MXN = 200;
/** Extra credit on every prepayment: pay $1,000, get $1,100. Fixed for every place. */
export const PREPAY_BONUS = 0.1;
/** Loyalty Reward: verified visits to this place that earn it. */
export const LOYALTY_VISITS = 7;
/** Instagram Story Reward: followers the public account needs. */
export const STORY_MIN_FOLLOWERS = 1000;

export const round2 = (n: number) => Math.round(n * 100) / 100;

export type AppliedReward = {
  id: RewardId;
  mode: RewardMode;
  percent: number;
  /** Pesos this reward is worth on this visit, after the cap. */
  amount: number;
  /** True when the cap cut this reward below its percent of the bill. */
  capped: boolean;
};

export type VisitRewards = {
  applied: AppliedReward[];
  /** Pesos off today's bill. */
  discount: number;
  /** Pesos added to the guest's Credits at this place. */
  cashback: number;
  /** discount + cashback: what the place gives on this visit. Never above the cap. */
  total: number;
};

/**
 * The rewards a visit gets. `earned` is what the guest qualified for; `chosen`
 * is the guest's own pick, in order. Without a pick, the two worth the most
 * win. Disabled rewards never apply, at most MAX_REWARDS_PER_VISIT apply, and
 * together they never pass `cap` pesos.
 */
export function rewardsForVisit(
  bill: number,
  earned: RewardId[],
  rules: RewardRule[],
  opts: { cap?: number; chosen?: RewardId[] } = {},
): VisitRewards {
  const cap = Math.max(0, opts.cap ?? DEFAULT_CAP_MXN);
  const empty: VisitRewards = { applied: [], discount: 0, cashback: 0, total: 0 };
  if (!(bill > 0)) return empty;

  const byId = new Map(rules.map((r) => [r.id, r]));
  const eligible = [...new Set(earned)]
    .map((id) => byId.get(id))
    .filter((r): r is RewardRule => !!r && r.enabled && r.percent > 0);

  const picked = opts.chosen
    ? opts.chosen
        .map((id) => eligible.find((r) => r.id === id))
        .filter((r): r is RewardRule => !!r)
    : [...eligible].sort((a, b) => b.percent - a.percent);

  let remaining = cap;
  const applied: AppliedReward[] = [];
  for (const rule of picked.slice(0, MAX_REWARDS_PER_VISIT)) {
    const percent = Math.min(100, Math.max(0, rule.percent));
    const raw = round2((bill * percent) / 100);
    const amount = round2(Math.min(raw, remaining));
    remaining = round2(remaining - amount);
    applied.push({ id: rule.id, mode: rule.mode, percent, amount, capped: amount < raw });
  }

  const sum = (mode: RewardMode) =>
    round2(applied.filter((a) => a.mode === mode).reduce((s, a) => s + a.amount, 0));
  const discount = sum("discount");
  const cashback = sum("cashback");
  return { applied, discount, cashback, total: round2(discount + cashback) };
}

/** The tip is a percent of the bill BEFORE rewards, so staff never lose tips to a discount. */
export function tipFor(bill: number, tipPercent: number): number {
  if (!(bill > 0) || !(tipPercent > 0)) return 0;
  return round2((bill * tipPercent) / 100);
}

/** What the guest pays today: the bill, minus the discount, plus the tip. */
export function amountDue(bill: number, rewards: VisitRewards, tip: number): number {
  return round2(Math.max(0, bill - rewards.discount) + tip);
}

/** Credits a prepayment buys: the amount paid plus the 10% bonus. */
export function creditsForPrepayment(paid: number): number {
  if (!(paid > 0)) return 0;
  return round2(paid * (1 + PREPAY_BONUS));
}
