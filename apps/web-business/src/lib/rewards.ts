// What the rewards are called on Rewards and Visits (MESITA-3202). Their
// percents, the cap and who qualifies are the server's.

import type { PaymentMethod, RewardKind } from "@/lib/business-api";

export const REWARD_COPY: Record<RewardKind, { name: string; line: string }> = {
  welcome_visit: { name: "Welcome Visit", line: "A guest's first visit." },
  returning_visit: { name: "Returning Visit", line: "Every visit after the first." },
  instagram_story: { name: "Instagram Story", line: "A guest with 1,000+ followers posts about your place. Staff check the story and that the profile is public." },
  vip_class: { name: "VIP Class", line: "Guests Mesita marks as VIP." },
};

/** The most one bill can add up to: a visit is a first one or a later one, plus Story, plus VIP (MESITA-3210). */
export function mostPercent(rewards: { kind: RewardKind; percent: number; enabled: boolean }[]): number {
  const percent = (kind: RewardKind) => rewards.find((r) => r.kind === kind && r.enabled)?.percent ?? 0;
  return Math.max(percent("welcome_visit"), percent("returning_visit")) + percent("instagram_story") + percent("vip_class");
}

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  transfer: "Transfer",
  other: "Other",
};

/** "$200 MXN": the code always shows (Pato, MESITA-3210: "mention the currency"). */
export function money(cents: number, currency: string): string {
  const amount = (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
  return `${amount} ${currency}`;
}
