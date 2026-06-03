"use client";

import { useState } from "react";
import { Loader2, Plus, ReceiptText, RefreshCw } from "lucide-react";
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
import { ScanTicketPanel } from "@/components/tickets/ScanTicketPanel";
import { TicketCard } from "@/components/tickets/TicketCard";

const TICKET_LIST_LIMIT = 100;

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
        "mb-4 rounded-xl px-3 py-2.5 text-xs leading-snug",
        error ? ERROR_BOX_CLASS : "bg-muted/60 text-muted-foreground",
      )}
      role="status"
    >
      <div className="flex items-start justify-between gap-2">
        <span>{error ?? notice}</span>
        <button
          type="button"
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground shrink-0 text-[10px] uppercase tracking-wide"
        >
          Dismiss
        </button>
      </div>
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

  const refresh = async () => {
    setBusy("refresh");
    setError(null);
    try {
      const rows = await apiListTickets(supabase, {
        venueId,
        limit: TICKET_LIST_LIMIT,
      });
      setTickets(rows);
      setNotice(`${rows.length} tickets`);
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
      const res = await apiMarkTicketPaid(supabase, ticketId);
      await reloadTickets(
        res.awaitingStory ? "Paid — waiting on story." : "Marked as paid.",
      );
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
    <div className="flex flex-col gap-8">
      <section>
        <button
          type="button"
          onClick={() => setScanOpen((v) => !v)}
          className="bg-foreground text-background hover:opacity-90 inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold transition"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Create ticket
        </button>
        {scanOpen ? (
          <ScanTicketPanel
            venueId={venueId}
            supabase={supabase}
            onCreated={(msg) => void reloadTickets(msg)}
            onError={setError}
            onClose={() => setScanOpen(false)}
          />
        ) : null}
      </section>

      <section>
        <div className="mb-1 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Tickets
            </h2>
            <p className="text-muted-foreground mt-0.5 text-[12px]">
              {tickets.length === 0
                ? "Scan a guest to start"
                : `${tickets.length} visible`}
            </p>
          </div>
          <button
            type="button"
            aria-label="Refresh tickets"
            onClick={() => void refresh()}
            disabled={busy === "refresh"}
            className="text-muted-foreground hover:text-foreground border-border/60 hover:border-border flex h-9 w-9 items-center justify-center rounded-full border transition disabled:opacity-40"
          >
            {busy === "refresh" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        <ScanFeedback
          error={error}
          notice={notice}
          onDismiss={() => {
            setError(null);
            setNotice(null);
          }}
        />

        <div className="border-border/60 bg-card/40 rounded-2xl border px-4 md:px-5">
          {tickets.length === 0 ? (
            <EmptyState
              icon={<ReceiptText className="text-muted-foreground/60 h-5 w-5" />}
              title="No tickets yet"
              description="Create a ticket to scan a guest — billing comes next on each row."
              className="py-10"
            />
          ) : (
            tickets.map((t) => (
              <TicketCard
                key={t.id}
                ticket={t}
                venueCurrency={venueCurrency}
                supabase={supabase}
                busy={busy}
                onMarkPaid={(id) => void markPaid(id)}
                onCancel={(id) => void cancelTicket(id)}
                onBillSubmitted={(msg) =>
                  void reloadTickets(msg, t.id)
                }
                onError={setError}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
