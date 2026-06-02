"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Gift, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
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

type TicketBundle = {
  ticketId: string;
  payload: TicketBillPayload;
  payment?: PayNotificationRow;
  review?: PayNotificationRow;
};

type ReviewDraft = {
  food: number;
  service: number;
  ambiance: number;
  overall: number;
  comments: string;
};

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

function StepPill({
  label,
  state,
}: {
  label: string;
  state: "done" | "active" | "upcoming";
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
        state === "done" && "bg-secondary/15 text-secondary",
        state === "active" && "bg-foreground text-background",
        state === "upcoming" && "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

function ticketSteps(bundle: TicketBundle): { current: TicketStep } {
  const payDone = !bundle.payment || bundle.payment.status !== "pending";
  const reviewPending = bundle.review?.status === "pending";
  if (!payDone) {
    return { current: "pay" };
  }
  if (reviewPending) {
    return { current: "review" };
  }
  return { current: "done" };
}

function TicketModalBody({
  bundle,
  busy,
  error,
  reviewDraft,
  onReviewChange,
  onConfirmPayment,
  onSubmitReview,
}: {
  bundle: TicketBundle;
  busy: string | null;
  error: string | null;
  reviewDraft: {
    food: number;
    service: number;
    ambiance: number;
    overall: number;
    comments: string;
  };
  onReviewChange: (d: typeof reviewDraft) => void;
  onConfirmPayment: (ticketId: string) => void;
  onSubmitReview: (ticketId: string) => void;
}) {
  const p = bundle.payload;
  const steps = ticketSteps(bundle);
  const rewardCents =
    p.total_reward_cents ??
    (p.discount_cents ?? 0) + (p.redeem_cents ?? 0);
  const venueHref = p.venue_slug
    ? placeHref(p.venue_slug)
    : p.venue_id
      ? placeHref(p.venue_id)
      : null;

  return (
    <article className="flex flex-col gap-3">
      <section className="border-border bg-card overflow-hidden rounded-3xl border shadow-[0_4px_14px_rgba(17,0,10,0.08)]">
        <div className="bg-muted relative aspect-[16/9] w-full">
        {p.venue_photo_url ? (
          <Image
            src={p.venue_photo_url}
            alt={p.venue_name ?? "Venue"}
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
            <Link
              href={venueHref}
              className="text-background text-sm font-semibold underline-offset-2 hover:underline"
            >
              {p.venue_name ?? "Partner venue"}
            </Link>
          ) : (
            <p className="text-background text-sm font-semibold">
              {p.venue_name ?? "Partner venue"}
            </p>
          )}
        </div>
        </div>
      </section>

      <section className="border-border bg-card rounded-3xl border p-4 shadow-[0_4px_14px_rgba(17,0,10,0.08)]">
        <div className="flex items-center gap-3 rounded-2xl bg-[#ffeaf3] px-3 py-2.5">
          <div className="bg-secondary text-background flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            <Gift className="h-4 w-4" />
          </div>
          <div>
            <p className="text-secondary text-[10px] font-bold tracking-[0.14em] uppercase">
              Total reward
            </p>
            <p className="font-display text-foreground text-xl leading-none font-bold">
              {formatPayMx(rewardCents, p.currency)}
              {p.discount_percent != null && p.discount_percent > 0 ? (
                <span className="text-muted-foreground ml-1 text-sm font-medium">
                  ({p.discount_percent}% off)
                </span>
              ) : null}
            </p>
          </div>
        </div>

        {steps.current === "pay" && bundle.payment ? (
          <>
            <p className="text-muted-foreground mt-3 text-[12px]">
              Confirm payment to continue.
            </p>
            {error ? (
              <p className="bg-destructive/10 text-destructive mt-2 rounded-xl px-3 py-2 text-sm">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              disabled={busy === bundle.ticketId}
              onClick={() => onConfirmPayment(bundle.ticketId)}
              className="bg-foreground text-background mt-3 w-full rounded-full py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {busy === bundle.ticketId ? "Confirming…" : "I paid"}
            </button>
          </>
        ) : null}

        {steps.current === "review" && bundle.review ? (
          <>
            <p className="text-muted-foreground mt-3 text-[11px]">
              Step 2 — Rate your visit at {p.venue_name ?? "this place"}.
            </p>
            <div className="mt-3 space-y-2">
              <StarRow
                label="Food"
                value={reviewDraft.food}
                onChange={(v) => onReviewChange({ ...reviewDraft, food: v })}
              />
              <StarRow
                label="Service"
                value={reviewDraft.service}
                onChange={(v) => onReviewChange({ ...reviewDraft, service: v })}
              />
              <StarRow
                label="Ambiance"
                value={reviewDraft.ambiance}
                onChange={(v) =>
                  onReviewChange({ ...reviewDraft, ambiance: v })
                }
              />
              <StarRow
                label="Overall"
                value={reviewDraft.overall}
                onChange={(v) => onReviewChange({ ...reviewDraft, overall: v })}
              />
            </div>
            <textarea
              value={reviewDraft.comments}
              onChange={(e) =>
                onReviewChange({ ...reviewDraft, comments: e.target.value })
              }
              placeholder="Comments (optional)"
              rows={2}
              className="border-border bg-background text-foreground placeholder:text-muted-foreground mt-3 w-full resize-none rounded-2xl border px-3 py-2 text-sm"
            />
            {error ? (
              <p className="bg-destructive/10 text-destructive mt-2 rounded-xl px-3 py-2 text-sm">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              disabled={busy === bundle.ticketId}
              onClick={() => onSubmitReview(bundle.ticketId)}
              className="bg-foreground text-background mt-3 w-full rounded-full py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {busy === bundle.ticketId ? "Sending…" : "Submit review"}
            </button>
          </>
        ) : null}

        {steps.current === "done" ? (
          <p className="text-muted-foreground mt-3 text-sm">
            All steps complete for this visit.
          </p>
        ) : null}
      </section>
    </article>
  );
}

function TicketPreviewCard({
  bundle,
  onOpen,
}: {
  bundle: TicketBundle;
  onOpen: () => void;
}) {
  const p = bundle.payload;
  const rewardCents =
    p.total_reward_cents ??
    (p.discount_cents ?? 0) + (p.redeem_cents ?? 0);
  const steps = ticketSteps(bundle);
  const payState =
    steps.current === "pay"
      ? "active"
      : steps.current === "review" || steps.current === "done"
        ? "done"
        : "upcoming";
  const reviewState =
    steps.current === "review"
      ? "active"
      : steps.current === "done"
        ? "done"
        : "upcoming";
  const statusLabel =
    steps.current === "pay"
      ? "Pending payment"
      : steps.current === "review"
        ? "Pending review"
        : "Completed";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="border-border bg-card w-full rounded-2xl border p-3 text-left transition hover:bg-white/70"
    >
      <div className="bg-muted relative h-28 w-full overflow-hidden rounded-2xl">
        {p.venue_photo_url ? (
          <Image
            src={p.venue_photo_url}
            alt={p.venue_name ?? "Venue"}
            fill
            className="object-cover"
            sizes="(max-width: 430px) 100vw, 430px"
          />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center">
            <MapPin className="h-7 w-7 opacity-40" />
          </div>
        )}
      </div>

      <div className="border-border bg-background mt-2 rounded-2xl border px-3 py-2.5">
        <p className="text-foreground truncate text-base font-semibold">
          {p.venue_name ?? "Partner venue"}
        </p>
        <p className="text-muted-foreground mt-1 text-[12px]">{statusLabel}</p>
      </div>

      <div className="border-border bg-background mt-2 rounded-2xl border px-3 py-2.5">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <StepPill label="Pay" state={payState} />
          <StepPill label="Review" state={reviewState} />
        </div>
        <span className="bg-secondary/10 text-secondary inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold">
          Reward {formatPayMx(rewardCents, p.currency)}
        </span>
      </div>
    </button>
  );
}

/** Tickets from Pay notifications — open + completed history. */
export function PayTickets({ userId }: { userId: string }) {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  const [rows, setRows] = useState<PayNotificationRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState({
    food: 5,
    service: 5,
    ambiance: 5,
    overall: 5,
    comments: "",
  });

  const loadTickets = useCallback(async () => {
    const { data, error: qErr } = await supabase
      .from("consumer_pay_notifications")
      .select("*")
      .eq("consumer_id", userId)
      .order("created_at", { ascending: false });
    if (!qErr && data) setRows(data);
  }, [supabase, userId]);

  useEffect(() => {
    void loadTickets();
    const channel = supabase
      .channel(`pay-tickets:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "consumer_pay_notifications",
          filter: `consumer_id=eq.${userId}`,
        },
        () => {
          void loadTickets();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, loadTickets]);

  const bundles = useMemo(() => {
    const map = new Map<string, TicketBundle>();
    for (const n of rows) {
      let b = map.get(n.ticket_id);
      if (!b) {
        b = {
          ticketId: n.ticket_id,
          payload: payloadFromNotification(n.payload),
        };
        map.set(n.ticket_id, b);
      }
      if (n.kind === "payment_confirm") {
        b.payment = n;
        b.payload = { ...b.payload, ...payloadFromNotification(n.payload) };
      }
      if (n.kind === "review") {
        b.review = n;
        b.payload = { ...b.payload, ...payloadFromNotification(n.payload) };
      }
    }
    return [...map.values()];
  }, [rows]);

  const onConfirmPayment = async (ticketId: string) => {
    setBusy(ticketId);
    setError(null);
    try {
      await confirmTicketPayment(supabase, ticketId);
      await loadTickets();
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
      await loadTickets();
    } catch (e) {
      setError(errMsg(e, "Couldn't submit review."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <h2 className="text-foreground text-sm font-semibold">Tickets</h2>
        <p className="text-muted-foreground text-[11px]">
          Open + completed
        </p>
      </div>

      {bundles.length === 0 ? (
        <p className="border-border bg-card text-muted-foreground rounded-2xl border px-4 py-6 text-center text-sm">
          When your waiter opens a ticket at the table, it appears here with
          the venue photo, your total reward, and steps to finish. Completed
          tickets stay here as history.
        </p>
      ) : (
        bundles.map((b) => (
          <TicketPreviewCard
            key={b.ticketId}
            bundle={b}
            onOpen={() => router.push(`/pay/tickets/${b.ticketId}`, { scroll: false })}
          />
        ))
      )}
    </section>
  );
}
