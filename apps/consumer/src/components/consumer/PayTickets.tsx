"use client";

import { useRouter } from "next/navigation";
import { Ticket } from "lucide-react";
import { RewardsTicketCard } from "@/components/consumer/RewardsTicketCard";
import { ticketPath } from "@/lib/consumer-route-contract";
import {
  bundleToCardView,
  type PayTicketsState,
} from "@/lib/hooks/useConsumerPayTickets";
import { TicketCardSkeleton } from "@/app/(shell)/rewards/PayTabLoading";

// Presentational tickets list — the fetch/poll lives in useConsumerPayTickets
// (lifted so the passport card and this list share one source). Renders the
// open + completed history, most recent first.
export function PayTickets({
  bundles,
  ticketMetaById,
  status,
  retry,
}: PayTicketsState) {
  const router = useRouter();

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <h2 className="text-foreground text-sm font-semibold">Tickets</h2>
        <p className="text-muted-foreground text-[11px]">Most recent first</p>
      </div>

      {status === "loading" ? (
        <>
          <TicketCardSkeleton />
          <TicketCardSkeleton />
        </>
      ) : status === "error" ? (
        <div className="border-destructive/30 bg-destructive/5 rounded-2xl border px-4 py-6 text-center">
          <p className="text-destructive text-sm font-semibold">
            Couldn&apos;t load your tickets.
          </p>
          <p className="text-muted-foreground mt-1 text-[12px] leading-relaxed">
            Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={retry}
            className="border-border bg-card hover:bg-muted mt-4 rounded-lg border px-5 py-2 text-sm font-semibold transition"
          >
            Retry
          </button>
        </div>
      ) : bundles.length === 0 ? (
        <div className="surface-card flex min-h-[240px] flex-1 flex-col items-center justify-center gap-3 rounded-2xl px-6 py-10 text-center">
          <span className="bg-primary/10 text-primary flex h-14 w-14 items-center justify-center rounded-2xl">
            <Ticket className="h-7 w-7" />
          </span>
          <p className="text-foreground text-[15px] font-semibold">
            No tickets yet
          </p>
          <p className="text-muted-foreground max-w-[300px] text-[13px] leading-relaxed">
            When staff opens your ticket at the table, it appears here with the
            place, your visit time, and the steps to finish. Completed tickets
            stay here as history.
          </p>
        </div>
      ) : (
        bundles.map((b) => (
          <RewardsTicketCard
            key={b.ticketId}
            view={bundleToCardView(b, ticketMetaById.get(b.ticketId))}
            onOpen={() => router.push(ticketPath(b.ticketId), { scroll: false })}
          />
        ))
      )}
    </section>
  );
}
