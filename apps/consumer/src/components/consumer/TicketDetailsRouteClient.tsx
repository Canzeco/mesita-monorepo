"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Gift, MapPin } from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  confirmTicketPayment,
  formatPayMx,
  payloadFromNotification,
  submitTicketReview,
  type PayNotificationRow,
  type TicketBillPayload,
} from "@/lib/api/pay";
import { errMsg } from "@/lib/utils";
import { placeHref } from "@/lib/place-route";

type TicketStep = "pay" | "review" | "done";

function ticketStepFromRows(rows: PayNotificationRow[]): TicketStep {
  const payment = rows.find((r) => r.kind === "payment_confirm");
  const review = rows.find((r) => r.kind === "review");
  const payDone = !payment || payment.status !== "pending";
  if (!payDone) return "pay";
  if (review?.status === "pending") return "review";
  return "done";
}

export function TicketDetailsRouteClient({
  userId,
  ticketId,
  variant = "page",
}: {
  userId: string;
  ticketId: string;
  variant?: "page" | "modal";
}) {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  const [rows, setRows] = useState<PayNotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState({
    food: 5,
    service: 5,
    ambiance: 5,
    overall: 5,
    comments: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: qErr } = await supabase
      .from("consumer_pay_notifications")
      .select("*")
      .eq("consumer_id", userId)
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: false });
    if (qErr) {
      setError(errMsg(qErr, "Couldn't load ticket."));
      setLoading(false);
      return;
    }
    setRows(data ?? []);
    setLoading(false);
  }, [supabase, userId, ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  const payload = useMemo<TicketBillPayload>(() => {
    const merged: TicketBillPayload = {};
    for (const row of rows) Object.assign(merged, payloadFromNotification(row.payload));
    return merged;
  }, [rows]);

  const step = useMemo(() => ticketStepFromRows(rows), [rows]);
  const rewardCents =
    payload.total_reward_cents ??
    (payload.discount_cents ?? 0) + (payload.redeem_cents ?? 0);
  const venueHref = payload.venue_slug
    ? placeHref(payload.venue_slug)
    : payload.venue_id
      ? placeHref(payload.venue_id)
      : null;

  const onConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await confirmTicketPayment(supabase, ticketId);
      await load();
    } catch (e) {
      setError(errMsg(e, "Couldn't confirm payment."));
    } finally {
      setBusy(false);
    }
  };

  const onReview = async () => {
    setBusy(true);
    setError(null);
    try {
      await submitTicketReview(supabase, {
        ticketId,
        ...reviewDraft,
        comments: reviewDraft.comments.trim() || undefined,
      });
      await load();
    } catch (e) {
      setError(errMsg(e, "Couldn't submit review."));
    } finally {
      setBusy(false);
    }
  };

  const onBack = () => {
    if (variant === "modal") router.back();
    else router.push("/pay/tickets");
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {variant === "page" ? (
        <div className="flex items-center gap-2 px-4 pt-3">
          <button
            type="button"
            onClick={onBack}
            className="border-border bg-card text-foreground rounded-full border p-2"
            aria-label="Back to tickets"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-foreground text-sm font-semibold">Ticket details</p>
        </div>
      ) : null}

      <div
        className={
          variant === "page"
            ? "scrollbar-hide min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-6"
            : "scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-8"
        }
      >
        {loading ? (
          <div
            className={
              variant === "modal"
                ? "space-y-3"
                : "mx-auto max-w-md space-y-3 rounded-[28px] border border-[#f1dbe6] bg-[#fff9fc] p-3 shadow-2xl"
            }
          >
            {variant === "page" ? (
              <div className="bg-foreground/20 mx-auto h-1.5 w-16 rounded-full" />
            ) : null}
            <div className="h-56 rounded-3xl bg-muted" />
            <div className="h-24 rounded-3xl bg-muted" />
            <div className="h-12 rounded-full bg-muted" />
          </div>
        ) : (
        <div className={variant === "modal" ? "space-y-3" : "mx-auto max-w-md rounded-[28px] border border-[#f1dbe6] bg-[#fff9fc] p-3 shadow-2xl"}>
          {variant === "page" ? (
            <div className="bg-foreground/20 mx-auto mb-2 h-1.5 w-16 rounded-full" />
          ) : null}
          <section className="border-border bg-card overflow-hidden rounded-3xl border shadow-[0_4px_14px_rgba(17,0,10,0.08)]">
            <div className="bg-muted relative aspect-[16/9] w-full">
              {payload.venue_photo_url ? (
                <Image
                  src={payload.venue_photo_url}
                  alt={payload.venue_name ?? "Venue"}
                  fill
                  className="object-cover"
                  sizes="(max-width: 430px) 100vw, 430px"
                />
              ) : (
                <div className="text-muted-foreground flex h-full items-center justify-center">
                  <MapPin className="h-8 w-8 opacity-40" />
                </div>
              )}
              <div className="from-foreground/70 absolute inset-x-0 bottom-0 bg-gradient-to-t to-transparent p-3 pt-10">
                {venueHref ? (
                  <Link href={venueHref} className="text-background text-sm font-semibold">
                    {payload.venue_name ?? "Partner venue"}
                  </Link>
                ) : (
                  <p className="text-background text-sm font-semibold">
                    {payload.venue_name ?? "Partner venue"}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="border-border bg-card mt-3 rounded-3xl border p-4 shadow-[0_4px_14px_rgba(17,0,10,0.08)]">
            <div className="flex items-center gap-3 rounded-2xl bg-[#ffeaf3] px-3 py-2.5">
              <div className="bg-secondary text-background flex h-9 w-9 items-center justify-center rounded-full">
                <Gift className="h-4 w-4" />
              </div>
              <div>
                <p className="text-secondary text-[10px] font-bold tracking-[0.14em] uppercase">Total reward</p>
                <p className="font-display text-foreground text-xl font-bold">
                  {formatPayMx(rewardCents, payload.currency)}
                </p>
              </div>
            </div>

            {step === "pay" ? (
              <button
                type="button"
                onClick={() => void onConfirm()}
                disabled={busy}
                className="bg-foreground text-background mt-3 w-full rounded-full py-2.5 text-sm font-medium disabled:opacity-50"
              >
                {busy ? "Confirming…" : "I paid"}
              </button>
            ) : null}

            {step === "review" ? (
              <div className="mt-3 space-y-2">
                {(["Food", "Service", "Ambiance", "Overall"] as const).map((label) => {
                  const key = label.toLowerCase() as "food" | "service" | "ambiance" | "overall";
                  return (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-muted-foreground text-[12px]">{label}</span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setReviewDraft((d) => ({ ...d, [key]: n }))}
                            className={`h-7 w-7 rounded-full text-sm ${reviewDraft[key] >= n ? "bg-secondary text-background" : "bg-muted text-muted-foreground"}`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <textarea
                  value={reviewDraft.comments}
                  onChange={(e) => setReviewDraft((d) => ({ ...d, comments: e.target.value }))}
                  placeholder="Comments (optional)"
                  rows={2}
                  className="border-border bg-background text-foreground mt-2 w-full rounded-2xl border px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void onReview()}
                  disabled={busy}
                  className="bg-foreground text-background w-full rounded-full py-2.5 text-sm font-medium disabled:opacity-50"
                >
                  {busy ? "Sending…" : "Submit review"}
                </button>
              </div>
            ) : null}

            {step === "done" ? (
              <p className="text-muted-foreground mt-3 text-sm">All steps complete for this visit.</p>
            ) : null}

            {error ? (
              <p className="bg-destructive/10 text-destructive mt-3 rounded-xl px-3 py-2 text-sm">{error}</p>
            ) : null}
          </section>
        </div>
        )}
      </div>
    </div>
  );
}

