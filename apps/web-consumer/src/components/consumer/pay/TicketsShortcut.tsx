import { ChevronRight, Ticket } from "lucide-react";

import { PushLink } from "@/components/consumer/nav/PushLink";
import { HEADER_PILL } from "@/components/consumer/search/header-classes";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { cn } from "@/lib/utils";

// THE TICKETS SHORTCUT (Pato, 2026-11-14, MESITA-3891: "in wallet at the
// top up show a shortcut to transactions/tickets in me", then the same "top
// right" on Pay): the band's grey pill at the right of the "Pay" and "Wallet"
// titles, opening Me › Tickets (every visit, voucher, gift and refund), pushed
// with Back. The band's own control shape
// (Search's Ask AI pill), so it reads as a control, not a fourth button next
// to Share and Gift. Reads nothing: the page and its loading frame draw it.
// 36px here, not the band pill's 40 (MESITA-4087: the shorter title band);
// Search keeps its 40px pill. INK since MESITA-4091 (Pato: "tickets button
// in pay and in wallet must be dark in order to make it visible"): the
// black of Continue, white words and icon. A BUTTON, NOT A PILL (MESITA-4107,
// Pato: "tickets must look like a button. maybe tickets>"): the app's button
// corners (rounded-xl, as Continue) and a › after the word.
export function TicketsShortcut() {
  return (
    <PushLink
      href={CONSUMER_ROUTES.mePages.tickets}
      className={cn(HEADER_PILL, "bg-muted text-foreground hover:bg-border h-9 rounded-xl border-transparent pr-2 pl-3")}
      data-tickets-shortcut
    >
      <Ticket className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      Tickets
      <ChevronRight className="-ml-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
    </PushLink>
  );
}
