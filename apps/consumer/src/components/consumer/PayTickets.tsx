"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Gift, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { TicketVisitShell } from "@/components/consumer/TicketVisitShell";
import {
  isTicketFlowComplete,
  resolveTicketFlowSteps,
  ticketProgressFromBundle,
} from "@/lib/ticket-flow-steps";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  confirmTicketPayment,
  buildTicketTransactionSummary,
  formatPayMx,
  formatTicketRewardLabel,
  formatTicketVisitDate,
  payloadFromNotification,
  submitTicketReview,
  type PayNotificationRow,
  type TicketBillPayload,
} from "@/lib/api/pay";
import { errMsg } from "@/lib/utils";
import { placeHref } from "@/lib/place-route";
import { ticketPath } from "@/lib/consumer-route-contract";

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
              "h-8 w-8 rounded-full text-base transition active:scale-95",
              value >= n
                ? "bg-pink-gradient text-white shadow-sm"
                : "bg-muted/90 text-muted-foreground/70",
            )}
          >
            ★
          </button>
        ))}
      </div>
    </div>
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
      <section className="surface-card-soft overflow-hidden">
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

      <section className="surface-card-soft p-4">
        <div className="reward-highlight">
          <div className="bg-pink-gradient text-background flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm">
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
              className="btn-primary mt-3"
            >
              {busy === bundle.ticketId ? "Confirming…" : "Paid issued"}
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
              className="btn-primary mt-3"
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

type TicketMeta = {
  kind?: string;
  status?: string;
  story_status?: string;
  story_submitted_at?: string | null;
  total_cents?: number | null;
  consumer_payment_confirmed_at?: string | null;
  staff_payment_confirmed_at?: string | null;
  discount_percent?: number | null;
  cashback_percent?: number | null;
  capMxn?: number | null;
  created_at?: string | null;
};

function TicketPreviewCard({
  bundle,
  ticketMeta,
  onOpen,
}: {
  bundle: TicketBundle;
  ticketMeta?: TicketMeta;
  onOpen: () => void;
}) {
  const p = bundle.payload;
  const enriched: TicketBillPayload = {
    ...p,
    discount_percent: p.discount_percent ?? ticketMeta?.discount_percent,
    cashback_percent: p.cashback_percent ?? ticketMeta?.cashback_percent,
  };
  const capMxn =
    p.reward_cap_mxn ?? p.monthly_promo_cap ?? ticketMeta?.capMxn ?? null;
  const ticketKind = ticketMeta?.kind ?? p.ticket_kind ?? "dp";
  const progress = ticketProgressFromBundle({
    kind: ticketKind,
    status: ticketMeta?.status,
    story_status: ticketMeta?.story_status,
    story_submitted_at: ticketMeta?.story_submitted_at,
    total_cents: ticketMeta?.total_cents ?? p.total_cents,
    consumer_payment_confirmed_at: ticketMeta?.consumer_payment_confirmed_at,
    staff_payment_confirmed_at: ticketMeta?.staff_payment_confirmed_at,
    payment: bundle.payment,
    review: bundle.review,
  });
  const flowSteps = resolveTicketFlowSteps(progress);
  const isComplete = isTicketFlowComplete(progress);
  const transactionSummary = isComplete
    ? buildTicketTransactionSummary(enriched, ticketKind)
    : null;
  const visitDateIso =
    ticketMeta?.created_at ??
    bundle.payment?.created_at ??
    bundle.review?.created_at ??
    null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left transition active:scale-[0.995]"
    >
      <TicketVisitShell
        venueName={p.venue_name ?? "Partner venue"}
        venuePhotoUrl={p.venue_photo_url}
        rewardLabel={formatTicketRewardLabel(enriched, { capMxn })}
        visitDateLabel={formatTicketVisitDate(visitDateIso)}
        steps={flowSteps}
        stepperInteractive={false}
        transactionSummary={transactionSummary}
      />
    </button>
  );
}

/** Tickets from Pay notifications — open + completed history. */
export function PayTickets({ userId }: { userId: string }) {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  const [rows, setRows] = useState<PayNotificationRow[]>([]);
  const [ticketMetaById, setTicketMetaById] = useState<Map<string, TicketMeta>>(
    new Map(),
  );
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
    if (qErr || !data) return;

    setRows(data);

    const ticketIds = [...new Set(data.map((n) => n.ticket_id))];
    if (ticketIds.length === 0) {
      setTicketMetaById(new Map());
      return;
    }

    const { data: ticketRows } = await supabase
      .from("tickets")
      .select(
        "id, kind, status, story_status, story_submitted_at, discount_percent, cashback_percent, venue_id, total_cents, consumer_payment_confirmed_at, staff_payment_confirmed_at, created_at",
      )
      .in("id", ticketIds);

    const venueIds = [
      ...new Set(
        (ticketRows ?? [])
          .map((t) => t.venue_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const venueCapById = new Map<string, number>();
    if (venueIds.length > 0) {
      const { data: venueRows } = await supabase
        .from("venues")
        .select("id, monthly_promo_cap")
        .in("id", venueIds);
      for (const v of venueRows ?? []) {
        if (v.monthly_promo_cap != null && v.monthly_promo_cap > 0) {
          venueCapById.set(v.id, v.monthly_promo_cap);
        }
      }
    }

    const meta = new Map<string, TicketMeta>();
    for (const t of ticketRows ?? []) {
      meta.set(t.id, {
        kind: t.kind,
        status: t.status,
        story_status: t.story_status,
        story_submitted_at: t.story_submitted_at,
        total_cents: t.total_cents,
        consumer_payment_confirmed_at: t.consumer_payment_confirmed_at,
        staff_payment_confirmed_at: t.staff_payment_confirmed_at,
        discount_percent: t.discount_percent,
        cashback_percent: t.cashback_percent,
        capMxn: t.venue_id ? venueCapById.get(t.venue_id) ?? null : null,
        created_at: t.created_at,
      });
    }
    setTicketMetaById(meta);
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
        <p className="surface-card text-muted-foreground px-4 py-8 text-center text-sm leading-relaxed">
          When staff opens your ticket at the table, it appears here with
          the venue photo, your total reward, and steps to finish. Completed
          tickets stay here as history.
        </p>
      ) : (
        bundles.map((b) => (
          <TicketPreviewCard
            key={b.ticketId}
            bundle={b}
            ticketMeta={ticketMetaById.get(b.ticketId)}
            onOpen={() => router.push(ticketPath(b.ticketId), { scroll: false })}
          />
        ))
      )}
    </section>
  );
}
