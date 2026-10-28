import type { Perk } from "@/components/consumer/me/perk-list";
import type { GuestPlan } from "@/lib/guest-standing";
import { FREE_RESERVATIONS_PER_MONTH } from "@/lib/plan-perks";

// Me › Plan's words, row by row. PlanModal draws them, and so does /me/plan's
// loading.tsx, which draws the perks as themselves so its lines wrap where
// the page's do (Pato, MESITA-2701: "the placeholders must be similar to the
// page you are loading, like the sizes"). The words exist once, here.
//
// A PLAIN MODULE, NOT PlanModal's: the fallback is a server component, and a
// value it imports from a "use client" file arrives as a client reference,
// not the words.
//
// NO PRICE, NO HYPOTHESIS (see PlanModal). Free states today's enforced cap;
// Premier opens with "Everything in Free", then its unbuilt perks, each Soon.

export type PlanRowWords = {
  title: string;
  /** The row's line when it is not the guest's plan ("Your plan." when it is). */
  subtitle: string;
  /** The perk list's accessible name. */
  label: string;
  items: Perk[];
};

export const PLAN_ROWS: Record<GuestPlan, PlanRowWords> = {
  free: {
    title: "Free",
    subtitle: "The free plan.",
    label: "Included in Free",
    items: [
      { text: "Browse and save places" },
      { text: "Mesita calls the place to book your table" },
      { text: `${FREE_RESERVATIONS_PER_MONTH} reservations a month` },
    ],
  },
  premium: {
    title: "Premier",
    subtitle: "The paid plan.",
    label: "Included in Premier",
    items: [
      {
        text: `Everything in Free, including ${FREE_RESERVATIONS_PER_MONTH} reservations a month`,
      },
      { text: "More reservations every month", soon: true },
      {
        text: "Ask your AI assistant, like ChatGPT, to find and book places for you",
        soon: true,
      },
    ],
  },
};
