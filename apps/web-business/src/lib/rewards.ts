// What the rewards are called on Rewards and Visits (MESITA-3202). Their
// percents, the cap and who qualifies are the server's.

import type { PaymentMethod, RewardKind } from "@/lib/business-api";

export const REWARD_COPY: Record<RewardKind, { name: string; line: string }> = {
  welcome_visit: { name: "Welcome Visit", line: "A guest's first visit to your place." },
  returning_visit: { name: "Returning Visit", line: "Every visit after the first." },
  instagram_story: { name: "Instagram Story", line: "A guest posts a story about your place. Check it on their phone." },
  vip_class: { name: "VIP Class", line: "Guests Mesita marks as VIP." },
};

/** Why a guest can't use a reward today. */
export const REWARD_REASON: Record<string, string> = {
  not_first_visit: "Not their first visit",
  first_visit: "This is their first visit",
  not_vip: "Not a VIP guest",
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  transfer: "Transfer",
  other: "Other",
};

export function money(cents: number, currency: string): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}
