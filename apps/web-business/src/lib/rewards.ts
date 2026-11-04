// What the rewards are called on Rewards and Visits (MESITA-3202). Their
// percents, the cap and who qualifies are the server's.

import type { PaymentMethod, RewardKind } from "@/lib/business-api";

export const REWARD_COPY: Record<RewardKind, { name: string; line: string }> = {
  welcome_visit: { name: "Welcome Visit", line: "A guest's first visit to your place." },
  returning_visit: { name: "Returning Visit", line: "Every visit after the first." },
  instagram_story: { name: "Instagram Story", line: "A guest posts a story about your place. Only with 1,000 or more Instagram followers, which Mesita checks. Look at the story and that the profile is public on their phone." },
  vip_class: { name: "VIP Class", line: "Guests Mesita marks as VIP." },
};

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
