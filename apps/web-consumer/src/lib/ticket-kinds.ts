// THE FOUR KINDS OF TICKET (Pato, 2026-11-14, MESITA-3855: "Tickets includes
// the list of all the transactions: there are 4 types of tickets — Visit,
// Voucher, Gift, Refund"). Me › Tickets lists them all, and one chip each
// narrows the list to its kind at /me/tickets/<kind>. They were four of
// Activity's chips (MESITA-3697, MESITA-3771) until Activity left the bar.
//
// A PLAIN MODULE ON PURPOSE: next.config loads legacy-redirects.ts, which
// imports this, so nothing here may import React or a client component.

//
// GIFTS IN AND GIFTS OUT (Pato, 2026-11-14, MESITA-3941: "add Gifts-In and
// Gifts-Out in the tickets ... you need to decide like in or out"): a gift
// is one or the other. In: credit a friend sent you. Out: credit you sent,
// a link you took back, a link nobody took yet. The old /me/tickets/gifts
// address lands on Gifts In (legacy-redirects.ts).
export const TICKET_KINDS = [
  "visits",
  "vouchers",
  "gifts-in",
  "gifts-out",
  "refunds",
] as const;

export type TicketKind = (typeof TICKET_KINDS)[number];

/** `/me/tickets`, or one kind's chip at `/me/tickets/<kind>`. */
export function ticketsHref(kind?: TicketKind): string {
  return kind ? `/me/tickets/${kind}` : "/me/tickets";
}

/** Whether `value` names a kind. */
export function isTicketKind(value: string | null | undefined): value is TicketKind {
  return (TICKET_KINDS as readonly string[]).includes(value ?? "");
}
