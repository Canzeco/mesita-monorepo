"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Check, QrCode, RefreshCcw, X } from "lucide-react";
import {
  cancelTicket,
  listTickets,
  markTicketPaid,
  type AdminTicket,
  type AdminVenue,
} from "../actions";
import { ErrorNote, SectionCard, Spinner } from "../ui";

const FINAL = new Set(["revealed", "cancelled", "paid", "closed"]);

function money(cents: number | null, currency: string | null) {
  if (cents == null) return "—";
  const n = (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency ? `${currency} ` : "$"}${n}`;
}

const STATUS_TONE: Record<string, string> = {
  open: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  awaiting_story: "border-violet-500/30 bg-violet-500/10 text-violet-700",
  awaiting_payment_confirm: "border-sky-500/30 bg-sky-500/10 text-sky-700",
  revealed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  cancelled: "border-border bg-muted text-muted-foreground",
};

export function ScanSection({ venue }: { venue: AdminVenue }) {
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, start] = useTransition();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const r = await listTickets(venue.id);
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setTickets(r.data);
  }, [venue.id]);

  // Initial fetch: set state only after the await so nothing is set
  // synchronously in the effect body (load() is reused for refresh/actions).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await listTickets(venue.id);
      if (cancelled) return;
      setLoading(false);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setError(null);
      setTickets(r.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [venue.id]);

  const act = (id: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusyId(id);
    setError(null);
    start(async () => {
      const r = await fn();
      setBusyId(null);
      if (!r.ok) {
        setError(r.error ?? "Action failed.");
        return;
      }
      await load();
    });
  };

  return (
    <SectionCard
      icon={<QrCode className="text-muted-foreground h-4 w-4" />}
      title="Scan"
      subtitle={`Tickets for ${venue.name}. Confirm payment or cancel open tickets.`}
      action={
        <button
          type="button"
          onClick={() => void load()}
          className="border-border hover:border-foreground/40 inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition"
        >
          <RefreshCcw className="h-3.5 w-3.5" /> Refresh
        </button>
      }
    >
      {error && <ErrorNote message={error} />}
      {loading ? (
        <Spinner label="Loading tickets…" />
      ) : tickets.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">No tickets yet.</p>
      ) : (
        <div className="mt-5 flex flex-col gap-2">
          {tickets.map((t) => {
            const final = FINAL.has(t.status);
            const busy = busyId === t.id;
            return (
              <div
                key={t.id}
                className="border-border bg-background flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium tabular-nums">
                      {t.consumer?.code ?? "—"}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        STATUS_TONE[t.status] ?? "border-border bg-card text-muted-foreground"
                      }`}
                    >
                      {t.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {t.consumer?.full_name ?? "Guest"}
                    {" · "}
                    bill {money(t.check_subtotal_cents, t.currency)}
                    {t.discount_percent ? ` · −${t.discount_percent}%` : ""}
                    {t.discount_cents ? ` (${money(t.discount_cents, t.currency)})` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {!final && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => act(t.id, () => markTicketPaid(t.id))}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/20 disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" /> Paid
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => act(t.id, () => cancelTicket(t.id))}
                        className="border-border hover:border-destructive/50 hover:text-destructive inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" /> Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
