"use client";

// Inbox › Visits — every ticket you hold, live ones first.
//
// This is the TRACKING view of a visit. Rewards stays the place you START one
// (pick a place, open a ticket) and where you pay; Inbox is where you watch
// the ones already in flight. Same data either way: this reads the very same
// useConsumerTickets hook the Rewards wallet does, so a ticket that moves
// status shows the same caption in both places and there is no second source
// of truth to drift.
//
// Live before closed, deliberately. A visit in progress is the only thing on
// this whole surface with a QR someone is waiting to scan — it outranks
// history no matter how recent the history is.

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { QrCode, TicketX } from "lucide-react";

import { TicketRow } from "@/components/consumer/rewards/TicketRow";
import { TicketCardSkeleton } from "@/app/(shell)/new-visit/NewVisitLoading";
import { EmptyState } from "@/components/shared";
import { useConsumerTickets } from "@/lib/hooks/useConsumerTickets";
import { CONSUMER_ROUTES, ticketPath } from "@/lib/consumer-route-contract";

export function InboxVisitsClient({ userId }: { userId: string }) {
  const router = useRouter();
  const tickets = useConsumerTickets(userId);

  const openTicket = (id: string) => router.push(ticketPath(id));

  const sections = useMemo(
    () => [
      { key: "live", label: "In progress", rows: tickets.active },
      { key: "closed", label: "Closed", rows: tickets.history },
    ],
    [tickets.active, tickets.history],
  );

  if (tickets.status === "loading") {
    return (
      <div className="scrollbar-hide h-full overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-2.5">
          <TicketCardSkeleton />
          <TicketCardSkeleton />
          <TicketCardSkeleton />
        </div>
      </div>
    );
  }

  if (tickets.status === "error") {
    return (
      <EmptyState
        icon={TicketX}
        title="Couldn't load your visits"
        description="Your tickets didn't come back just now. Try again in a moment."
        action={{ label: "Try again", onClick: tickets.retry }}
      />
    );
  }

  if (tickets.active.length === 0 && tickets.history.length === 0) {
    return (
      <EmptyState
        icon={QrCode}
        title="No visits yet"
        description="Start a visit from the Visit tab and it shows up here — with its QR and whatever you saved."
        action={{ label: "Start a visit", href: CONSUMER_ROUTES.newVisit.root }}
      />
    );
  }

  return (
    <div className="scrollbar-hide h-full overflow-y-auto px-4 py-4">
      {sections.map(({ key, label, rows }) =>
        rows.length === 0 ? null : (
          <section key={key} className="mb-5 last:mb-0">
            <div className="mb-2 flex items-center gap-3 px-1">
              <p className="text-muted-foreground type-label font-semibold tracking-[0.14em] uppercase">
                {label}
              </p>
              <span className="bg-border h-px flex-1" />
              <p className="text-muted-foreground type-label font-semibold tabular-nums">
                {rows.length}
              </p>
            </div>
            <div className="flex flex-col gap-2.5">
              {rows.map((ticket) => (
                <TicketRow
                  key={ticket.id}
                  ticket={ticket}
                  onOpen={() => openTicket(ticket.id)}
                />
              ))}
            </div>
          </section>
        ),
      )}
    </div>
  );
}
