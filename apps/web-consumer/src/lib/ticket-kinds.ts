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
// address lands on Gifts-In (legacy-redirects.ts).
//
// ONE GIFTS LIST AGAIN (Pato, 2026-11-15, MESITA-4036: "Unify gifts events in
// and out. Only one view of gift events. Left side is sender and right side
// is receiver"): /me/tickets/gifts; /gifts-in and /gifts-out forward there.
//
// REFUNDS LEFT TICKETS (Pato, 2026-11-18, MESITA-4402: "remove refunds from
// there. but refunds as something in settings"): /me/settings/refunds.
//
// STORIES (Pato, 2026-11-18, MESITA-4405: Tickets gets a Stories tab):
// /me/tickets/stories, each Story at /me/tickets/stories/<id>.
// ORDER (Pato, 2026-11-20: "Visits. Vouchers. Stories. Gifts. THIS ORDER").
// NO STORIES TAB (Pato, 2026-11-21, MESITA-4627: "ONLY VOUCHERS AND VISITS
// AND GIFTS. THE STORY THING IS JUST ONE EXTRA STEP"): a Story voucher is a
// Vouchers row; /me/tickets/stories forwards to Vouchers, and each Story's
// screen keeps its /me/tickets/stories/<id> address. Order as the tabs
// (MESITA-4623: "Vouchers Visits Gifts").
export const TICKET_KINDS = [
  "vouchers",
  "visits",
  "gifts",
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
