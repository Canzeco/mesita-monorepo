import type { Perk } from "@/components/consumer/me/perk-list";
import type { GuestPlan } from "@/lib/guest-standing";
import { FREE_RESERVATIONS_PER_MONTH, PRO_RESERVATIONS_PER_MONTH } from "@/lib/plan-perks";

// Me › Plan's words, row by row. PlanModal draws them, and so does /me/plan's
// loading.tsx, which draws the perks as themselves so its lines wrap where
// the page's do (Pato, MESITA-2701: "the placeholders must be similar to the
// page you are loading, like the sizes"). The words exist once, here.
//
// A PLAIN MODULE, NOT PlanModal's: the fallback is a server component, and a
// value it imports from a "use client" file arrives as a client reference,
// not the words.
//
// NO PRICE (see PlanModal). Each plan states its enforced monthly cap
// (MESITA-2555); Pro opens with "Everything in Free", then its cap, then its
// unbuilt perks, each Soon.

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
    title: "Pro",
    subtitle: "The paid plan.",
    label: "Included in Pro",
    items: [
      { text: "Everything in Free" },
      { text: `${PRO_RESERVATIONS_PER_MONTH} reservations a month` },
      {
        text: "Ask your AI assistant, like ChatGPT, to find and book places for you",
        soon: true,
      },
    ],
  },
};
