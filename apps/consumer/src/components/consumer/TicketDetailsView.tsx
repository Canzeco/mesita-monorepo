"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  TicketActionCard,
  TicketWaitingStaffBanner,
} from "@/components/consumer/TicketActionCard";
import { TicketVisitComplete } from "@/components/consumer/TicketVisitComplete";
import { TicketVisitHeader } from "@/components/consumer/TicketVisitHeader";
import { TicketReviewForm } from "@/components/consumer/TicketReviewForm";
import {
  discountPaymentPhase,
  isTicketFlowComplete,
  resolveTicketFlowSteps,
  STEP_NOW_TITLE,
  ticketProgressFromBundle,
  type TicketFlowStepId,
  type TicketFlowStepView,
  type TicketProgressInput,
} from "@/lib/ticket-flow-steps";
import { TicketEmbeddedPayment } from "@/components/consumer/TicketEmbeddedPayment";
import type {
  TicketBillPayload,
  TicketTransactionSummary as TicketTransactionSummaryData,
} from "@/lib/api/pay";

export type TicketDetailsViewProps = {
  ticketKind: string;
  payload: TicketBillPayload;
  capMxn?: number | null;
  venueName: string;
  venueHref: string | null;
  visitDateLabel: string | null;
  rewardLabel: string;
  ticketMeta: {
    status?: string;
    story_status?: string;
    story_submitted_at?: string | null;
    total_cents?: number | null;
    consumer_payment_confirmed_at?: string | null;
    staff_payment_confirmed_at?: string | null;
  } | null;
  payment?: { status: string } | null;
  review?: { status: string } | null;
  transactionSummary: TicketTransactionSummaryData | null;
  reviewDraft: {
    food: number;
    service: number;
    ambiance: number;
    overall: number;
    comments: string;
  };
  onReviewDraftChange: (d: TicketDetailsViewProps["reviewDraft"]) => void;
  busy: boolean;
  error: string | null;
  onConfirmPayment: () => void;
  onSubmitReview: () => void;
  onMockStoryDetect?: () => void;
  showMockStoryButton?: boolean;
  venueInstagramHandle?: string | null;
  ticketId?: string;
  paymentReturnUrl?: string;
  onPaymentComplete?: () => void;
  onPaymentError?: (message: string) => void;
};

export function TicketDetailsView({
  ticketKind,
  payload,
  capMxn,
  venueName,
  venueHref,
  visitDateLabel,
  rewardLabel,
  ticketMeta,
  payment,
  review,
  transactionSummary,
  reviewDraft,
  onReviewDraftChange,
  busy,
  error,
  onConfirmPayment,
  onSubmitReview,
  onMockStoryDetect,
  showMockStoryButton,
  venueInstagramHandle,
  ticketId,
  paymentReturnUrl,
  onPaymentComplete,
  onPaymentError,
}: TicketDetailsViewProps) {
  const stepCopy = useMemo(
    () => ({ venueInstagramHandle }),
    [venueInstagramHandle],
  );
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
        payment,
        review,
      }),
    [ticketKind, ticketMeta, payload.total_cents, payment, review],
  );

  const isComplete = isTicketFlowComplete(progress);
  const flowSteps = useMemo(
    () => resolveTicketFlowSteps(progress),
    [progress],
  );
  const activeStep = flowSteps.find((s) => s.state === "active");
  const [peekStepId, setPeekStepId] = useState<TicketFlowStepId | null>(null);

  useEffect(() => {
    setPeekStepId(null);
  }, [activeStep?.id]);

  const displayStepId: TicketFlowStepId = useMemo(() => {
    if (peekStepId && flowSteps.some((s) => s.id === peekStepId)) {
      const peek = flowSteps.find((s) => s.id === peekStepId)!;
      if (peek.state !== "upcoming") return peekStepId;
    }
    return activeStep?.id ?? flowSteps[flowSteps.length - 1]?.id ?? "scan";
  }, [peekStepId, activeStep, flowSteps]);

  const displayStep = flowSteps.find((s) => s.id === displayStepId);

  const statusLine = useMemo(() => {
    if (isComplete) return null;
    const active = flowSteps.find((s) => s.state === "active");
    if (!active) return null;
    return `${STEP_NOW_TITLE[active.id]} — in progress`;
  }, [isComplete, flowSteps]);

  const handleStepSelect = (id: TicketFlowStepId) => {
    const step = flowSteps.find((s) => s.id === id);
    if (!step || step.state === "upcoming") return;
    if (step.state === "active") setPeekStepId(null);
    else setPeekStepId(id);
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <TicketVisitHeader
        venueName={venueName}
        venueHref={venueHref}
        venuePhotoUrl={payload.venue_photo_url}
        rewardLabel={rewardLabel}
        visitDateLabel={visitDateLabel}
        steps={flowSteps}
        displayStepId={displayStepId}
        onStepSelect={isComplete ? undefined : handleStepSelect}
        stepperInteractive={!isComplete}
        transactionSummary={isComplete ? transactionSummary : null}
        statusLine={statusLine}
      />

      {isComplete && transactionSummary ? (
        <TicketVisitComplete ticketKind={ticketKind} />
      ) : displayStep ? (
        <TicketActionCard
          step={displayStep}
          progress={progress}
          payload={payload}
          ticketKind={ticketKind}
          capMxn={capMxn}
          stepCopy={stepCopy}
        >
          {renderStepActions({
            step: displayStep,
            progress,
            busy,
            reviewDraft,
            onReviewDraftChange,
            onConfirmPayment,
            onSubmitReview,
            onMockStoryDetect,
            showMockStoryButton,
            ticketId,
            paymentReturnUrl,
            onPaymentComplete,
            onPaymentError,
          })}
        </TicketActionCard>
      ) : null}

      {error ? (
        <p className="bg-destructive/10 text-destructive rounded-2xl px-4 py-3 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function renderStepActions({
  step,
  progress,
  busy,
  onConfirmPayment,
  onSubmitReview,
  onMockStoryDetect,
  showMockStoryButton,
  ticketId,
  paymentReturnUrl,
  onPaymentComplete,
  onPaymentError,
  reviewDraft,
  onReviewDraftChange,
}: {
  step: TicketFlowStepView;
  progress: TicketProgressInput;
  busy: boolean;
  reviewDraft: TicketDetailsViewProps["reviewDraft"];
  onReviewDraftChange: TicketDetailsViewProps["onReviewDraftChange"];
  onConfirmPayment: () => void;
  onSubmitReview: () => void;
  onMockStoryDetect?: () => void;
  showMockStoryButton?: boolean;
  ticketId?: string;
  paymentReturnUrl?: string;
  onPaymentComplete?: () => void;
  onPaymentError?: (message: string) => void;
}): ReactNode {
  if (step.state !== "active") return null;

  if (step.id === "story" && showMockStoryButton && onMockStoryDetect) {
    return (
      <button
        type="button"
        onClick={onMockStoryDetect}
        disabled={busy}
        className="w-full rounded-xl border border-dashed border-secondary/50 bg-secondary/10 px-4 py-3 text-sm font-semibold text-secondary transition hover:bg-secondary/15 disabled:opacity-50"
      >
        {busy ? "Simulating…" : "Mock: story posted & detected"}
      </button>
    );
  }

  if (step.id === "pay") {
    const phase = discountPaymentPhase(progress);
    if (phase === "pending") {
      return (
        <button
          type="button"
          onClick={onConfirmPayment}
          disabled={busy}
          className="btn-primary py-3.5 text-base"
        >
          {busy ? "Sending…" : "I paid at the table"}
        </button>
      );
    }
    if (phase === "issued") {
      return <TicketWaitingStaffBanner />;
    }
  }

  if (step.id === "pay_stripe" && ticketId && paymentReturnUrl && onPaymentComplete) {
    return (
      <TicketEmbeddedPayment
        ticketId={ticketId}
        returnUrl={paymentReturnUrl}
        onComplete={onPaymentComplete}
        onError={onPaymentError}
      />
    );
  }

  if (step.id === "review") {
    return (
      <TicketReviewForm
        draft={reviewDraft}
        onChange={onReviewDraftChange}
        onSubmit={onSubmitReview}
        busy={busy}
        showIntro={false}
      />
    );
  }

  return null;
}
