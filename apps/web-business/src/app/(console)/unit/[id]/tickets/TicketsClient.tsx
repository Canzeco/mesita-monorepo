"use client";

import { useMemo, useState } from "react";
import { Loader2, ReceiptText, RefreshCw } from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiCancelTicket,
  apiListTickets,
  apiMarkTicketPaid,
  type BusinessTicket,
} from "@/lib/api/tickets";
import { cn, errMsg } from "@/lib/utils";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { EmptyState } from "@/components/shared";
import { SubTabs, type SubTabItem } from "@/components/business/SubTabs";
import { TicketCard } from "@/components/tickets/TicketCard";
import {
  ticketNeedsBill,
  ticketNeedsStaffPaymentConfirm,
} from "@/lib/ticket-staff-lifecycle";

const TICKET_LIST_LIMIT = 100;

type TicketFilter = "create" | "pending" | "done";

function ticketBucket(t: BusinessTicket): TicketFilter {
  if (t.status === "cancelled") return "done";
  if (ticketNeedsBill(t)) return "create";
  if (ticketNeedsStaffPaymentConfirm(t)) return "pending";
  if (t.status === "paid" || t.status === "revealed") return "done";
  return "pending";
}

const FILTER_EMPTY: Record<TicketFilter, string> = {
  create: "No tickets waiting on a bill.",
  pending: "No tickets awaiting payment.",
  done: "No closed tickets yet.",
};

export function TicketsClient({
  projectId,
  placeCurrency,
  initialTickets,
}: {
  projectId: string;
  placeCurrency: string;
  initialTickets: BusinessTicket[];
}) {
  const supabase = useBrowserSupabase();
  // Tickets v2 (MESITA-806): staff-initiated creation retired — guests
  // create their own tickets in the consumer app and staff scan the ticket
  // QR (mesita.ai/check/<code>). The console keeps the list, the bill form
  // (fallback), Paid received, and Cancel.
  const [tickets, setTickets] = useState(initialTickets);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TicketFilter>("create");

  const counts = useMemo(() => {
    const c = { create: 0, pending: 0, done: 0 };
    for (const t of tickets) c[ticketBucket(t)] += 1;
    return c;
  }, [tickets]);

  const visibleTickets = useMemo(
    () => tickets.filter((t) => ticketBucket(t) === filter),
    [tickets, filter],
  );

  const filterTabs: SubTabItem<TicketFilter>[] = [
    { id: "create", label: "New", count: counts.create },
    { id: "pending", label: "Pending", count: counts.pending },
    { id: "done", label: "Done", count: counts.done },
  ];

  const refresh = async () => {
    setBusy("refresh");
    setError(null);
    try {
      const rows = await apiListTickets(supabase, {
        projectId,
        limit: TICKET_LIST_LIMIT,
      });
      setTickets(rows);
    } catch (e) {
      setError(errMsg(e, "Couldn't refresh."));
    } finally {
      setBusy(null);
    }
  };

  const reloadTickets = async (message: string, billTicketId?: string) => {
    if (billTicketId) setBusy(`bill:${billTicketId}`);
    setError(null);
    try {
      const rows = await apiListTickets(supabase, {
        projectId,
        limit: TICKET_LIST_LIMIT,
      });
      setTickets(rows);
    } catch (e) {
      setError(errMsg(e, "Updated but refresh failed."));
    } finally {
      if (billTicketId) setBusy(null);
    }
  };

  const markPaid = async (ticketId: string) => {
    setBusy(`pay:${ticketId}`);
    setError(null);
    try {
      await apiMarkTicketPaid(supabase, ticketId);
      await reloadTickets("Payment confirmed.");
    } catch (e) {
      setError(errMsg(e, "Couldn't mark as paid."));
    } finally {
      setBusy(null);
    }
  };

  const cancelTicket = async (ticketId: string) => {
    setBusy(`cancel:${ticketId}`);
    setError(null);
    try {
      await apiCancelTicket(supabase, {
        ticketId,
        reason: "Cancelled from business console",
      });
      await reloadTickets("Ticket cancelled.");
    } catch (e) {
      setError(errMsg(e, "Couldn't cancel."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <SubTabs
        tabs={filterTabs}
        active={filter}
        onChange={setFilter}
        equalWidth
        className="-mx-4 px-2"
      />

      <div className="flex items-center gap-2">
        <p className="text-muted-foreground flex-1 text-[12.5px] leading-snug">
          Guests open their own tickets in the Mesita app — scan their ticket
          QR with any phone camera to verify and bill on the check page.
        </p>
        <button
          type="button"
          aria-label="Refresh tickets"
          onClick={() => void refresh()}
          disabled={busy === "refresh"}
          className="border-border/60 hover:border-border text-muted-foreground hover:text-foreground bg-card flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-40"
        >
          {busy === "refresh" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </button>
      </div>

      {error ? (
        <p className={cn(ERROR_BOX_CLASS, "text-[13px] leading-snug")} role="alert">
          {error}
        </p>
      ) : null}

      <section className="flex flex-col gap-2.5">
        {tickets.length === 0 ? (
          <EmptyState
            icon={<ReceiptText className="text-muted-foreground/60 h-5 w-5" />}
            title="No tickets yet"
            description="Guests start tickets from their Mesita app. Scan their ticket QR to verify and bill — new tickets also appear here."
            className="border-border/60 py-12"
          />
        ) : visibleTickets.length === 0 ? (
          <EmptyState
            icon={<ReceiptText className="text-muted-foreground/60 h-5 w-5" />}
            title={FILTER_EMPTY[filter]}
            description="Switch tabs above to see tickets in other stages."
            className="border-border/60 py-10"
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {visibleTickets.map((t) => (
              <li key={t.id}>
                <TicketCard
                  ticket={t}
                  placeCurrency={placeCurrency}
                  supabase={supabase}
                  busy={busy}
                  onMarkPaid={(id) => void markPaid(id)}
                  onCancel={(id) => void cancelTicket(id)}
                  onBillSubmitted={(msg) => void reloadTickets(msg, t.id)}
                  onError={setError}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
