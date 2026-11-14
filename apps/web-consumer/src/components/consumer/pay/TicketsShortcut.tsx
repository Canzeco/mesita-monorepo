import { Ticket } from "lucide-react";

import { PushLink } from "@/components/consumer/nav/PushLink";
import { HEADER_PILL } from "@/components/consumer/search/header-classes";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// THE TICKETS SHORTCUT (Pato, 2026-11-14, MESITA-3891: "in wallet at the
// top up show a shortcut to transactions/tickets in me", then the same "top
// right" on Pay): the band's grey pill at the right of the "Pay" and "Wallet"
// titles, opening Me › Tickets (every visit, voucher, gift and refund), pushed
// with Back. The band's own control shape
// (Search's Ask AI pill), so it reads as a control, not a fourth button next
// to Share and Gift. Reads nothing: the page and its loading frame draw it.
export function TicketsShortcut() {
  return (
    <PushLink
      href={CONSUMER_ROUTES.mePages.tickets}
      className={HEADER_PILL}
      data-tickets-shortcut
    >
      <Ticket className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      Tickets
    </PushLink>
  );
}
