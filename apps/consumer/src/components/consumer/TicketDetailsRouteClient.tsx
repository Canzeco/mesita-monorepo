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
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

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
  const stepIndex = step === "pay" ? 1 : step === "review" ? 2 : 3;

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
    else router.push(CONSUMER_ROUTES.pay.tickets);
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
          <div className="mx-auto w-full max-w-md space-y-3">
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="h-44 bg-muted" />
              <div className="space-y-3 p-4">
                <div className="h-4 w-2/3 rounded bg-muted" />
                <div className="h-9 w-36 rounded-xl bg-muted" />
              </div>
            </div>
            <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-9 w-full rounded-xl bg-muted" />
              <div className="h-9 w-full rounded-xl bg-muted" />
              <div className="h-10 w-full rounded-full bg-muted" />
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-md space-y-3">
            {/* Top rectangle: image + name + reward amount */}
            <section className="overflow-hidden rounded-2xl border border-border bg-card">
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
              </div>
              <div className="p-4">
                {venueHref ? (
                  <Link href={venueHref} className="text-foreground block truncate text-base font-semibold">
                    {payload.venue_name ?? "Partner venue"}
                  </Link>
                ) : (
                  <p className="text-foreground truncate text-base font-semibold">
                    {payload.venue_name ?? "Partner venue"}
                  </p>
                )}
                <div className="bg-secondary/10 text-secondary mt-3 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold">
                  <Gift className="h-4 w-4" />
                  Reward amount: {formatPayMx(rewardCents, payload.currency)}
                </div>
              </div>
            </section>

            {/* Bottom rectangle: progress */}
            <section className="rounded-2xl border border-border bg-card p-4">
              <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
                Progress
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                {[
                  { label: "Pay", n: 1 },
                  { label: "Review", n: 2 },
                  { label: "Done", n: 3 },
                ].map((s) => {
                  const active = stepIndex >= s.n;
                  return (
                    <div
                      key={s.label}
                      className={`rounded-xl border px-2 py-2 text-center font-medium ${active ? "border-secondary bg-secondary/10 text-secondary" : "border-border text-muted-foreground bg-background"}`}
                    >
                      <span className="block text-[10px] opacity-80">Step {s.n}</span>
                      <span className="mt-0.5 block">{s.label}</span>
                    </div>
                  );
                })}
              </div>

              {step === "pay" ? (
                <button
                  type="button"
                  onClick={() => void onConfirm()}
                  disabled={busy}
                  className="bg-foreground text-background mt-3 w-full rounded-full py-2.5 text-sm font-medium disabled:opacity-50"
                >
                  {busy ? "Confirming..." : "I paid"}
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
                    {busy ? "Sending..." : "Submit review"}
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

