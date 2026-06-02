"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  confirmTicketPayment,
  submitTicketReview,
  type PayNotificationRow,
} from "@/lib/api/pay";
import { errMsg } from "@/lib/utils";
type BillPayload = {
  venue_name?: string;
  check_subtotal_cents?: number;
  tip_cents?: number;
  total_cents?: number;
  discount_cents?: number;
  discount_percent?: number;
  redeem_cents?: number;
  amount_due_cents?: number;
  currency?: string;
};

function formatMx(cents: number | undefined, currency = "MXN") {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)} ${currency}`;
}

function StarRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground text-[12px]">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${label} ${n} stars`}
            onClick={() => onChange(n)}
            className={cn(
              "h-7 w-7 rounded-full text-sm transition",
              value >= n
                ? "bg-secondary text-background"
                : "bg-muted text-muted-foreground",
            )}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

export function PayNotifications({ userId }: { userId: string }) {
  const supabase = useBrowserSupabase();
  const [pending, setPending] = useState<PayNotificationRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState({
    food: 5,
    service: 5,
    ambiance: 5,
    overall: 5,
    comments: "",
  });

  const loadPending = useCallback(async () => {
    const { data, error: qErr } = await supabase
      .from("consumer_pay_notifications")
      .select("*")
      .eq("consumer_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (!qErr && data) setPending(data);
  }, [supabase, userId]);

  useEffect(() => {
    void loadPending();
    const channel = supabase
      .channel(`pay-notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "consumer_pay_notifications",
          filter: `consumer_id=eq.${userId}`,
        },
        () => {
          void loadPending();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, loadPending]);

  const onConfirmPayment = async (ticketId: string) => {
    setBusy(ticketId);
    setError(null);
    try {
      await confirmTicketPayment(supabase, ticketId);
      await loadPending();
    } catch (e) {
      setError(errMsg(e, "Couldn't confirm payment."));
    } finally {
      setBusy(null);
    }
  };

  const onSubmitReview = async (ticketId: string) => {
    setBusy(ticketId);
    setError(null);
    try {
      await submitTicketReview(supabase, {
        ticketId,
        ...reviewDraft,
        comments: reviewDraft.comments.trim() || undefined,
      });
      await loadPending();
    } catch (e) {
      setError(errMsg(e, "Couldn't submit review."));
    } finally {
      setBusy(null);
    }
  };

  if (pending.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p className="bg-destructive/10 text-destructive rounded-xl px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}
      {pending.map((n) => {
        const payload = (n.payload ?? {}) as BillPayload;
        if (n.kind === "payment_confirm") {
          return (
            <section
              key={n.id}
              className="border-secondary/40 bg-secondary/5 rounded-3xl border p-4"
            >
              <p className="text-secondary text-[10px] font-bold tracking-wider uppercase">
                Confirm payment
              </p>
              <p className="text-foreground mt-1 text-sm font-medium">
                {payload.venue_name ?? "Partner venue"}
              </p>
              <dl className="text-muted-foreground mt-2 space-y-0.5 text-[12px]">
                <div className="flex justify-between">
                  <dt>Bill</dt>
                  <dd>{formatMx(payload.total_cents, payload.currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>
                    Discount
                    {payload.discount_percent != null
                      ? ` (${payload.discount_percent}%)`
                      : ""}
                  </dt>
                  <dd>-{formatMx(payload.discount_cents, payload.currency)}</dd>
                </div>
                {(payload.redeem_cents ?? 0) > 0 ? (
                  <div className="flex justify-between">
                    <dt>Mesita balance</dt>
                    <dd>-{formatMx(payload.redeem_cents, payload.currency)}</dd>
                  </div>
                ) : null}
                <div className="text-foreground flex justify-between font-medium">
                  <dt>You pay</dt>
                  <dd>{formatMx(payload.amount_due_cents, payload.currency)}</dd>
                </div>
              </dl>
              <p className="text-muted-foreground mt-2 text-[11px]">
                Confirm once you&apos;ve paid the waiter (cash or card).
              </p>
              <button
                type="button"
                disabled={busy === n.ticket_id}
                onClick={() => void onConfirmPayment(n.ticket_id)}
                className="bg-foreground text-background mt-3 w-full rounded-full py-2.5 text-sm font-medium disabled:opacity-50"
              >
                {busy === n.ticket_id ? "Confirming…" : "I paid"}
              </button>
            </section>
          );
        }
        if (n.kind === "review") {
          return (
            <section
              key={n.id}
              className="border-border bg-card rounded-3xl border p-4"
            >
              <p className="text-secondary text-[10px] font-bold tracking-wider uppercase">
                Rate your visit
              </p>
              <p className="text-foreground mt-1 text-sm font-medium">
                {payload.venue_name ?? "Partner venue"}
              </p>
              <div className="mt-3 space-y-2">
                <StarRow
                  label="Food"
                  value={reviewDraft.food}
                  onChange={(v) => setReviewDraft((d) => ({ ...d, food: v }))}
                />
                <StarRow
                  label="Service"
                  value={reviewDraft.service}
                  onChange={(v) =>
                    setReviewDraft((d) => ({ ...d, service: v }))
                  }
                />
                <StarRow
                  label="Ambiance"
                  value={reviewDraft.ambiance}
                  onChange={(v) =>
                    setReviewDraft((d) => ({ ...d, ambiance: v }))
                  }
                />
                <StarRow
                  label="Overall"
                  value={reviewDraft.overall}
                  onChange={(v) =>
                    setReviewDraft((d) => ({ ...d, overall: v }))
                  }
                />
              </div>
              <textarea
                value={reviewDraft.comments}
                onChange={(e) =>
                  setReviewDraft((d) => ({ ...d, comments: e.target.value }))
                }
                placeholder="Comments (optional)"
                rows={2}
                className="border-border bg-background text-foreground placeholder:text-muted-foreground mt-3 w-full resize-none rounded-2xl border px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={busy === n.ticket_id}
                onClick={() => void onSubmitReview(n.ticket_id)}
                className="bg-foreground text-background mt-3 w-full rounded-full py-2.5 text-sm font-medium disabled:opacity-50"
              >
                {busy === n.ticket_id ? "Sending…" : "Submit review"}
              </button>
            </section>
          );
        }
        return null;
      })}
    </div>
  );
}
