"use client";

import { useState } from "react";
import { Loader2, ReceiptText, RefreshCw, XCircle } from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiCancelTicket,
  apiListTickets,
  apiMarkTicketPaid,
  type BusinessTicket,
} from "@/lib/api/tickets";
import { cn, errMsg } from "@/lib/utils";
import {
  ERROR_BOX_CLASS,
  INFO_BOX_CLASS,
  PILL_BUTTON_CLASS,
  TINY_LABEL_CLASS,
} from "@/lib/ui-classes";
import { EmptyState, Section } from "@/components/shared";

function centsToMoney(cents: number | null, currency: string): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: currency || "MXN",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function statusTone(status: BusinessTicket["status"]): string {
  if (status === "pending_pay" || status === "awaiting_payment_confirm") {
    return "bg-amber-500/10 text-amber-700";
  }
  if (status === "paid" || status === "revealed") {
    return "bg-emerald-500/10 text-emerald-700";
  }
  if (status === "awaiting_story") {
    return "bg-violet-500/10 text-violet-700";
  }
  if (status === "cancelled") {
    return "bg-muted text-muted-foreground";
  }
  return "bg-secondary/10 text-secondary";
}

function titleFor(ticket: BusinessTicket): string {
  const name = ticket.consumer?.full_name?.trim();
  const code = ticket.consumer?.code?.trim();
  if (name) return name;
  if (code) return `Guest ${code}`;
  return "Guest";
}

export function TicketsClient({
  venueId,
  initialTickets,
}: {
  venueId: string;
  initialTickets: BusinessTicket[];
}) {
  const supabase = useBrowserSupabase();
  const [tickets, setTickets] = useState(initialTickets);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = async () => {
    setBusy("refresh");
    setError(null);
    try {
      const rows = await apiListTickets(supabase, { venueId, limit: 40 });
      setTickets(rows);
      setNotice(`Updated ${rows.length} tickets.`);
    } catch (e) {
      setError(errMsg(e, "Couldn't refresh tickets."));
    } finally {
      setBusy(null);
    }
  };

  const markPaid = async (ticketId: string) => {
    setBusy(`pay:${ticketId}`);
    setError(null);
    setNotice(null);
    try {
      const res = await apiMarkTicketPaid(supabase, ticketId);
      const rows = await apiListTickets(supabase, { venueId, limit: 40 });
      setTickets(rows);
      setNotice(
        res.awaitingStory
          ? "Payment confirmed. Ticket is waiting for story verification."
          : "Ticket marked as paid.",
      );
    } catch (e) {
      setError(errMsg(e, "Couldn't mark ticket as paid."));
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
      const rows = await apiListTickets(supabase, { venueId, limit: 40 });
      setTickets(rows);
      setNotice("Ticket cancelled.");
    } catch (e) {
      setError(errMsg(e, "Couldn't cancel ticket."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="Recent tickets"
        description="Type A and formal ticket rows opened by staff."
        right={
          <button
            type="button"
            className={cn(PILL_BUTTON_CLASS, "px-3 py-1.5")}
            onClick={() => void refresh()}
            disabled={busy === "refresh"}
          >
            {busy === "refresh" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </button>
        }
      >
        <div className="flex flex-col gap-3">
          {error ? <p className={ERROR_BOX_CLASS}>{error}</p> : null}
          {notice ? <p className={INFO_BOX_CLASS}>{notice}</p> : null}
          {tickets.length === 0 ? (
            <EmptyState
              icon={<ReceiptText className="text-muted-foreground h-5 w-5" />}
              title="No tickets yet"
              description="As soon as staff opens tickets, they will appear here for review."
            />
          ) : (
            tickets.map((t) => {
              const pendingPay =
                t.status === "pending_pay" || t.status === "awaiting_payment_confirm";
              const canCancel = t.status === "pending_pay";
              const payBusy = busy === `pay:${t.id}`;
              const cancelBusy = busy === `cancel:${t.id}`;
              return (
                <article
                  key={t.id}
                  className="border-border bg-background rounded-2xl border p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{titleFor(t)}</p>
                      <p className="text-muted-foreground text-[11px]">
                        {t.consumer?.code ? `Code ${t.consumer.code}` : "No code"} ·{" "}
                        {new Date(t.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        statusTone(t.status),
                      )}
                    >
                      {t.status.replaceAll("_", " ")}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] md:grid-cols-4">
                    <p>
                      <span className={TINY_LABEL_CLASS}>Total</span>
                      <br />
                      <span className="font-medium">
                        {centsToMoney(t.total_cents, t.currency)}
                      </span>
                    </p>
                    <p>
                      <span className={TINY_LABEL_CLASS}>Cashback</span>
                      <br />
                      <span className="font-medium">
                        {centsToMoney(t.cashback_cents, t.currency)}
                      </span>
                    </p>
                    <p>
                      <span className={TINY_LABEL_CLASS}>Redeem</span>
                      <br />
                      <span className="font-medium">
                        {centsToMoney(t.redeem_cents, t.currency)}
                      </span>
                    </p>
                    <p>
                      <span className={TINY_LABEL_CLASS}>Kind</span>
                      <br />
                      <span className="font-medium">{t.kind}</span>
                    </p>
                  </div>

                  {(pendingPay || canCancel) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {pendingPay ? (
                        <button
                          type="button"
                          onClick={() => void markPaid(t.id)}
                          disabled={payBusy || busy === "refresh"}
                          className={cn(PILL_BUTTON_CLASS, "px-3 py-1.5")}
                        >
                          {payBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          Mark paid
                        </button>
                      ) : null}
                      {canCancel ? (
                        <button
                          type="button"
                          onClick={() => void cancelTicket(t.id)}
                          disabled={cancelBusy || busy === "refresh"}
                          className="border-border bg-card text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition disabled:opacity-60"
                        >
                          {cancelBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </Section>
    </div>
  );
}
