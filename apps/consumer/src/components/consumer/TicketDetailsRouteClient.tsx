"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { TicketFlowStepDetailPanel } from "@/components/consumer/TicketFlowStepDetailPanel";
import { TicketTransactionSummary } from "@/components/consumer/TicketTransactionSummary";
import {
  isTicketFlowComplete,
  resolveTicketFlowSteps,
  STEP_SEQUENCE_DETAILS,
  STEP_SEQUENCE_SUMMARY,
  ticketProgressFromBundle,
  type TicketFlowStepView,
} from "@/lib/ticket-flow-steps";
import { errMsg } from "@/lib/utils";
import { placeHref } from "@/lib/place-route";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { cn } from "@/lib/utils";

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
        "kind, status, story_status, story_submitted_at, total_cents, consumer_payment_confirmed_at, created_at",
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

  const renderStepSummary = (step: TicketFlowStepView) => {
    const summary = STEP_SEQUENCE_SUMMARY[step.id];
    const line =
      step.state === "done" ? summary.done : summary.upcoming;

    if (step.id === "bill" && step.state === "done" && payload.total_cents) {
      return (
        <TicketBillSummary
          payload={payload}
          capMxn={capMxn}
          ticketKind={ticketKind}
        />
      );
    }

    if (
      step.id === "review" &&
      step.state === "done" &&
      transactionSummary
    ) {
      return (
        <TicketTransactionSummary summary={transactionSummary} variant="detail" />
      );
    }

    return (
      <p className="text-muted-foreground text-[13px] leading-relaxed">
        {line}
      </p>
    );
  };

  const renderStepFullDetail = (step: TicketFlowStepView) => {
    const bullets = STEP_SEQUENCE_DETAILS[step.id];
    const lead =
      step.state === "active"
        ? STEP_SEQUENCE_SUMMARY[step.id].upcoming
        : null;

    return (
      <div className="space-y-3">
        {lead ? (
          <p className="text-foreground text-[13px] leading-relaxed">{lead}</p>
        ) : null}

        <ul className="text-muted-foreground space-y-1.5 text-[13px] leading-relaxed">
          {bullets.map((line, i) => {
            const text = typeof line === "string" ? line : line.text;
            const struck = typeof line === "object" && line.struck;

            return (
              <li key={`${step.id}-${i}`} className="flex gap-2">
                <span className="text-secondary/80 mt-1 shrink-0 text-[10px]">●</span>
                <span className={cn(struck && "text-muted-foreground/60 line-through")}>
                  {text}
                </span>
              </li>
            );
          })}
        </ul>

        {step.id === "bill" && payload.total_cents ? (
          <TicketBillSummary
            payload={payload}
            capMxn={capMxn}
            ticketKind={ticketKind}
          />
        ) : null}

        {step.id === "pay" || step.id === "pay_stripe" ? (
          <div className="surface-card space-y-2 p-3">
            <p className="text-foreground text-[13px] font-medium">
              Ready to confirm payment?
            </p>
            <p className="text-muted-foreground text-[12px] leading-relaxed">
              Tap below once you&apos;ve paid the amount due.
            </p>
            <button
              type="button"
              onClick={() => void onConfirm()}
              disabled={busy}
              className="btn-primary"
            >
              {busy ? "Confirming..." : "Paid issued"}
            </button>
          </div>
        ) : null}

        {step.id === "review" ? (
          <div className="surface-card space-y-2.5 p-3">
            <p className="text-foreground text-[13px] font-medium">
              How was your visit?
            </p>
            <StarRow
              label="Food"
              value={reviewDraft.food}
              onChange={(v) => setReviewDraft((d) => ({ ...d, food: v }))}
            />
            <StarRow
              label="Service"
              value={reviewDraft.service}
              onChange={(v) => setReviewDraft((d) => ({ ...d, service: v }))}
            />
            <StarRow
              label="Ambiance"
              value={reviewDraft.ambiance}
              onChange={(v) => setReviewDraft((d) => ({ ...d, ambiance: v }))}
            />
            <StarRow
              label="Overall"
              value={reviewDraft.overall}
              onChange={(v) => setReviewDraft((d) => ({ ...d, overall: v }))}
            />
            <textarea
              value={reviewDraft.comments}
              onChange={(e) =>
                setReviewDraft((d) => ({ ...d, comments: e.target.value }))
              }
              placeholder="Comments (optional)"
              rows={2}
              className="border-border bg-background text-foreground w-full rounded-xl border px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void onReview()}
              disabled={busy}
              className="btn-primary"
            >
              {busy ? "Sending..." : "Submit review"}
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  const renderStepDetail = (step: TicketFlowStepView) =>
    step.state === "active"
      ? renderStepFullDetail(step)
      : renderStepSummary(step);

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
            className="surface-card text-foreground rounded-full p-2"
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
            <div className="surface-card p-3">
              <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
                <div className="h-[88px] rounded-md bg-muted" />
                <div className="flex h-[88px] flex-col gap-2">
                  <div className="min-h-0 flex-1 rounded-md bg-muted" />
                  <div className="min-h-0 flex-1 rounded-md bg-muted" />
                </div>
              </div>
            </div>
            <div className="surface-card space-y-3 p-4">
              <div className="h-3 w-16 rounded bg-muted" />
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex gap-3">
                    <div className="h-8 w-8 shrink-0 rounded-full bg-muted" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-3 w-20 rounded bg-muted" />
                      <div className="h-12 rounded-lg bg-muted/40" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
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
                  {venueHref ? (
                    <Link
                      href={venueHref}
                      className="text-muted-foreground hover:text-foreground text-[12px] font-medium transition"
                    >
                      View place →
                    </Link>
                  ) : null}
                </div>
              </div>

              {activeStep ? (
                <div className="border-border/60 from-secondary/8 border-t bg-gradient-to-r to-transparent px-3 py-2.5">
                  <p className="text-muted-foreground text-[12px]">
                    Current step:{" "}
                    <span className="text-foreground font-semibold">
                      {activeStep.label}
                    </span>
                  </p>
                </div>
              ) : isComplete ? (
                <div className="border-border/60 from-secondary/8 border-t bg-gradient-to-r to-transparent px-3 py-2.5">
                  <p className="text-secondary text-[12px] font-medium">
                    Visit complete
                  </p>
                </div>
              ) : null}
            </section>

            <section>
              <div className="surface-card p-4">
                <div className="mb-4">
                  <h2 className="text-foreground text-base font-semibold">
                    Step-by-step
                  </h2>
                  <p className="text-muted-foreground mt-1 text-[13px] leading-relaxed">
                    {isComplete
                      ? "Everything from scan to review for this visit."
                      : activeStep
                        ? `You're on ${activeStep.label.toLowerCase()}. Done steps show a short summary; the current step has full details.`
                        : "Track each step of your visit."}
                  </p>
                </div>

                <TicketFlowStepDetailPanel
                  steps={flowSteps}
                  renderStepDetail={renderStepDetail}
                />

                {error ? (
                  <p className="bg-destructive/10 text-destructive mt-4 rounded-xl px-3 py-2.5 text-sm">
                    {error}
                  </p>
                ) : null}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

