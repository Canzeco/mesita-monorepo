import type { GuestPlan } from "@/lib/guest-standing";
import {
  FREE_RESERVATIONS_PER_MONTH,
  PRO_PRICE_CENTS,
  PRO_RESERVATIONS_PER_MONTH,
} from "@/lib/plan-perks";

// Me › Plan's words, row by row. PlanModal draws them, and so does /me/plan's
// loading.tsx. A PLAIN MODULE, NOT PlanModal's: the fallback is a server
// component, and a value it imports from a "use client" file arrives as a
// client reference, not the words.
//
// ONE CAPABILITY (Pato, 2026-11-14, MESITA-3870: "2 Reservations per month is
// Free. 10 Reservations per month if Pro. thats it. and make it 2 dollar per
// month ... only that capability for the moment nothing else"): each plan is
// its reservations a month and its price. The MCP perk left with it.

export type PlanRowWords = {
  title: string;
  /** The price line. */
  price: string;
  /** The one capability. */
  perk: string;
};

/** "$2" for whole dollars, "$2.50" otherwise. */
export function dollars(cents: number): string {
  return cents % 100 === 0
    ? `$${cents / 100}`
    : `$${(cents / 100).toFixed(2)}`;
}

export const PRO_PRICE_LINE = `${dollars(PRO_PRICE_CENTS)} a month`;

export const PLAN_ROWS: Record<GuestPlan, PlanRowWords> = {
  free: {
    title: "Free",
    price: "Free",
    perk: `Max ${FREE_RESERVATIONS_PER_MONTH} reservations a month`,
  },
  premium: {
    title: "Pro",
    price: PRO_PRICE_LINE,
    perk: `Max ${PRO_RESERVATIONS_PER_MONTH} reservations a month`,
  },
};
