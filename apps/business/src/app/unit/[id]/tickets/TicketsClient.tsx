"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, ReceiptText, RefreshCw, ScanLine } from "lucide-react";
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
import { ScanTicketPanel } from "@/components/tickets/ScanTicketPanel";
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

function ScanFeedback({
  error,
  notice,
  onDismiss,
}: {
  error: string | null;
  notice: string | null;
  onDismiss: () => void;
}) {
  if (!error && !notice) return null;
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-[13px] leading-snug",
        error
          ? ERROR_BOX_CLASS
          : "border-border/60 bg-card text-foreground/80 border",
      )}
      role="status"
    >
      <span className="min-w-0">{error ?? notice}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground shrink-0 text-[11px] font-medium"
      >
        Dismiss
      </button>
    </div>
  );
}

export function TicketsClient({
  venueId,
  venueCurrency,
  initialTickets,
}: {
  venueId: string;
  venueCurrency: string;
  initialTickets: BusinessTicket[];
}) {
  const supabase = useBrowserSupabase();
  const [tickets, setTickets] = useState(initialTickets);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
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
        venueId,
        limit: TICKET_LIST_LIMIT,
      });
      setTickets(rows);
      setNotice(`${rows.length} tickets loaded`);
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
        venueId,
        limit: TICKET_LIST_LIMIT,
      });
      setTickets(rows);
      setNotice(message);
      if (message.includes("scanned")) setScanOpen(false);
    } catch (e) {
      setError(errMsg(e, "Updated but refresh failed."));
    } finally {
      if (billTicketId) setBusy(null);
    }
  };

  const markPaid = async (ticketId: string) => {
    setBusy(`pay:${ticketId}`);
    setError(null);
    setNotice(null);
    try {
      await apiMarkTicketPaid(supabase, ticketId);
      await reloadTickets("Payment confirmed — ticket closed.");
    } catch (e) {
      setError(errMsg(e, "Couldn't mark as paid."));
    } finally {
      setBusy(null);
    }
  };

  const cancelTicket = async (ticketId: string) => {
    setBusy(`cancel:${ticketId}`);
    setError(null);
    setNotice(null);
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
        <button
          type="button"
          onClick={() => setScanOpen((v) => !v)}
          className={cn(
            "bg-pink-gradient inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold text-white shadow-sm transition hover:opacity-90",
            scanOpen && "ring-primary/30 ring-2 ring-offset-2",
          )}
        >
          {scanOpen ? (
            <ScanLine className="h-4 w-4" strokeWidth={2.5} />
          ) : (
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          )}
          {scanOpen ? "Scanning…" : "New ticket"}
        </button>
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

      {scanOpen ? (
        <ScanTicketPanel
          venueId={venueId}
          supabase={supabase}
          onCreated={(msg) => void reloadTickets(msg)}
          onError={setError}
          onClose={() => setScanOpen(false)}
        />
      ) : null}

      <ScanFeedback
        error={error}
        notice={notice}
        onDismiss={() => {
          setError(null);
          setNotice(null);
        }}
      />

      <section className="flex flex-col gap-2.5">
        {tickets.length === 0 ? (
          <EmptyState
            icon={<ReceiptText className="text-muted-foreground/60 h-5 w-5" />}
            title="No tickets yet"
            description="Tap New ticket to scan a guest code. You'll enter the bill on their row right after."
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
                  venueCurrency={venueCurrency}
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
