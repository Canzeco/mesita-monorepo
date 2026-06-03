"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, MapPin } from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  confirmTicketPayment,
  buildTicketTransactionSummary,
  formatTicketRewardLabel,
  formatTicketVenueTitle,
  payloadFromNotification,
  submitTicketReview,
  type PayNotificationRow,
  type TicketBillPayload,
} from "@/lib/api/pay";
import { TicketBillSummary } from "@/components/consumer/TicketBillSummary";
import { TicketDetailsSkeleton } from "@/components/consumer/TicketDetailsSkeleton";
import { TicketFlowStepDetailPanel } from "@/components/consumer/TicketFlowStepDetailPanel";
import { TicketTransactionSummary } from "@/components/consumer/TicketTransactionSummary";
import {
  discountPaymentPhase,
  isTicketFlowComplete,
  resolveTicketFlowSteps,
  STEP_NOW_TITLE,
  ticketStepNowInstructions,
  ticketProgressFromBundle,
  type TicketFlowStepView,
} from "@/lib/ticket-flow-steps";
import { errMsg } from "@/lib/utils";
import { placeHref } from "@/lib/place-route";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { TicketReviewForm } from "@/components/consumer/TicketReviewForm";
import { TicketStepInstructions } from "@/components/consumer/TicketStepInstructions";

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
  const [ticketMeta, setTicketMeta] = useState<{
    kind?: string;
    status?: string;
    story_status?: string;
    story_submitted_at?: string | null;
    total_cents?: number | null;
    consumer_payment_confirmed_at?: string | null;
    staff_payment_confirmed_at?: string | null;
    created_at?: string | null;
  } | null>(null);
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

    const { data: ticketRow } = await supabase
      .from("tickets")
      .select(
        "kind, status, story_status, story_submitted_at, total_cents, consumer_payment_confirmed_at, staff_payment_confirmed_at, created_at",
      )
      .eq("id", ticketId)
      .maybeSingle();
    setTicketMeta(ticketRow ?? null);

    setLoading(false);
  }, [supabase, userId, ticketId]);

  useEffect(() => {
    void load();
  }, [load, ticketId]);

  const payload = useMemo<TicketBillPayload>(() => {
    const merged: TicketBillPayload = {};
    for (const row of rows) Object.assign(merged, payloadFromNotification(row.payload));
    return merged;
  }, [rows]);

  const ticketKind = ticketMeta?.kind ?? payload.ticket_kind ?? "dp";
  const reviewNotification = rows.find((r) => r.kind === "review");
  const progress = useMemo(
    () =>
      ticketProgressFromBundle({
        kind: ticketKind,
        status: ticketMeta?.status,
        story_status: ticketMeta?.story_status,
        story_submitted_at: ticketMeta?.story_submitted_at,
        total_cents: ticketMeta?.total_cents ?? payload.total_cents,
        consumer_payment_confirmed_at: ticketMeta?.consumer_payment_confirmed_at,
        staff_payment_confirmed_at: ticketMeta?.staff_payment_confirmed_at,
        payment: rows.find((r) => r.kind === "payment_confirm"),
        review: reviewNotification,
      }),
    [
      ticketKind,
      ticketMeta,
      payload.total_cents,
      rows,
      reviewNotification,
    ],
  );
  const isComplete = isTicketFlowComplete(progress);
  const flowSteps = useMemo(
    () => resolveTicketFlowSteps(progress),
    [progress],
  );
  const transactionSummary = useMemo(
    () =>
      isComplete ? buildTicketTransactionSummary(payload, ticketKind) : null,
    [isComplete, payload, ticketKind],
  );
  const visitDateIso =
    ticketMeta?.created_at ??
    rows.find((r) => r.kind === "payment_confirm")?.created_at ??
    rows[0]?.created_at ??
    null;
  const venueTitle = formatTicketVenueTitle(payload.venue_name, visitDateIso);
  const venueHref = payload.venue_slug
    ? placeHref(payload.venue_slug)
    : payload.venue_id
      ? placeHref(payload.venue_id)
      : null;
  const capMxn = payload.reward_cap_mxn ?? payload.monthly_promo_cap ?? null;
  const rewardLabel = formatTicketRewardLabel(payload, { capMxn });
  const activeStep = flowSteps.find((s) => s.state === "active");

  const onConfirm = useCallback(async () => {
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
  }, [supabase, ticketId, load]);

  const onReview = useCallback(async () => {
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
  }, [supabase, ticketId, reviewDraft, load]);

  const renderActiveContent = useCallback(
    (step: TicketFlowStepView): ReactNode => {
      if (step.id === "bill" && payload.total_cents) {
        return (
          <TicketBillSummary
            payload={payload}
            capMxn={capMxn}
            ticketKind={ticketKind}
          />
        );
      }

      if (step.id === "pay" && discountPaymentPhase(progress) === "pending") {
        return (
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={busy}
            className="btn-primary"
          >
            {busy ? "Sending…" : "I paid — Paid issued"}
          </button>
        );
      }

      if (step.id === "review") {
        return (
          <TicketReviewForm
            draft={reviewDraft}
            onChange={setReviewDraft}
            onSubmit={() => void onReview()}
            busy={busy}
            venueName={payload.venue_name}
          />
        );
      }

      return null;
    },
    [
      payload,
      capMxn,
      ticketKind,
      progress,
      busy,
      reviewDraft,
      onConfirm,
      onReview,
    ],
  );

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
            className="surface-card text-foreground rounded-full p-2"
            aria-label="Back to tickets"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-foreground text-sm font-semibold">Your visit</p>
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
          <TicketDetailsSkeleton />
        ) : (
          <div className="mx-auto w-full max-w-md space-y-4">
            <section className="surface-card overflow-hidden">
              <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 p-3">
                <div className="bg-muted relative h-[72px] overflow-hidden rounded-xl ring-1 ring-border/60">
                  {payload.venue_photo_url ? (
                    <Image
                      src={payload.venue_photo_url}
                      alt={payload.venue_name ?? "Venue"}
                      fill
                      className="object-cover"
                      sizes="72px"
                    />
                  ) : (
                    <div className="text-muted-foreground flex h-full items-center justify-center">
                      <MapPin className="h-5 w-5 opacity-40" />
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 flex-col justify-center gap-1">
                  {venueHref ? (
                    <Link
                      href={venueHref}
                      className="text-foreground truncate text-[15px] leading-tight font-semibold transition hover:opacity-80"
                    >
                      {venueTitle}
                    </Link>
                  ) : (
                    <p className="text-foreground truncate text-[15px] leading-tight font-semibold">
                      {venueTitle}
                    </p>
                  )}
                  <p className="text-secondary text-[13px] leading-snug font-medium">
                    {rewardLabel}
                  </p>
                </div>
              </div>

              {activeStep && !isComplete ? (
                <div className="border-border/60 border-t space-y-2 px-3 py-3">
                  <div>
                    <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
                      What to do now
                    </p>
                    <p className="text-foreground mt-0.5 text-lg font-semibold leading-tight">
                      {STEP_NOW_TITLE[activeStep.id]}
                    </p>
                  </div>
                  <TicketStepInstructions
                    steps={ticketStepNowInstructions(activeStep.id, progress)}
                  />
                </div>
              ) : isComplete ? (
                <div className="border-border/60 border-t px-3 py-3">
                  <p className="text-secondary text-sm font-semibold">
                    All done
                  </p>
                </div>
              ) : null}
            </section>

            <section className="surface-card p-4">
              <p className="text-muted-foreground mb-3 text-[11px] font-semibold tracking-[0.1em] uppercase">
                Steps
              </p>

              <TicketFlowStepDetailPanel
                steps={flowSteps}
                progress={progress}
                renderActiveContent={renderActiveContent}
              />

              {isComplete && transactionSummary ? (
                <div className="border-border/60 mt-4 border-t pt-4">
                  <TicketTransactionSummary
                    summary={transactionSummary}
                    variant="detail"
                  />
                </div>
              ) : null}

              {error ? (
                <p className="bg-destructive/10 text-destructive mt-4 rounded-xl px-3 py-2 text-sm">
                  {error}
                </p>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

