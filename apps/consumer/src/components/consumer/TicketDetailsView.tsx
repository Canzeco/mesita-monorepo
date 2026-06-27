"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { TicketActionCard } from "@/components/consumer/TicketActionCard";
import { TicketVisitComplete } from "@/components/consumer/TicketVisitComplete";
import { TicketVisitHeader } from "@/components/consumer/TicketVisitHeader";
import { TicketReviewForm } from "@/components/consumer/TicketReviewForm";
import {
  isTicketFlowComplete,
  resolveTicketFlowSteps,
  STEP_NOW_TITLE,
  ticketProgressFromBundle,
  type TicketFlowStepId,
  type TicketFlowStepView,
  type TicketProgressInput,
} from "@/lib/ticket-flow-steps";
import type {
  TicketBillPayload,
  TicketTransactionSummary as TicketTransactionSummaryData,
} from "@/lib/api/pay";

export type TicketDetailsViewProps = {
  ticketKind: string;
  payload: TicketBillPayload;
  capMxn?: number | null;
  placeName: string;
  placeHref: string | null;
  visitDateLabel: string | null;
  rewardLabel: string;
  ticketMeta: {
    status?: string;
    story_status?: string;
    story_submitted_at?: string | null;
    total_cents?: number | null;
  } | null;
  payment?: { status: string } | null;
  review?: { status: string } | null;
  transactionSummary: TicketTransactionSummaryData | null;
  reviewDraft: {
    food: number;
    service: number;
    ambiance: number;
    value: number;
    overall: number;
    comments: string;
  };
  onReviewDraftChange: (d: TicketDetailsViewProps["reviewDraft"]) => void;
  busy: boolean;
  error: string | null;
  onSubmitReview: () => void;
  onMockStoryDetect?: () => void;
  showMockStoryButton?: boolean;
  placeInstagramHandle?: string | null;
};

export function TicketDetailsView({
  ticketKind,
  payload,
  capMxn,
  placeName,
  placeHref,
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
  onSubmitReview,
  onMockStoryDetect,
  showMockStoryButton,
  placeInstagramHandle,
}: TicketDetailsViewProps) {
  const stepCopy = useMemo(
    () => ({ placeInstagramHandle }),
    [placeInstagramHandle],
  );
  const progress = useMemo(
    () =>
      ticketProgressFromBundle({
        kind: ticketKind,
        status: ticketMeta?.status,
        story_status: ticketMeta?.story_status,
        story_submitted_at: ticketMeta?.story_submitted_at,
        total_cents: ticketMeta?.total_cents ?? payload.total_cents,
        payment,
        review,
      }),
    [ticketKind, ticketMeta, payload.total_cents, payment, review],
  );

  const isComplete = isTicketFlowComplete(progress);
  const flowSteps = useMemo(() => resolveTicketFlowSteps(progress), [progress]);
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
        placeName={placeName}
        placeHref={placeHref}
        placePhotoUrl={payload.place_photo_url}
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
            busy,
            reviewDraft,
            onReviewDraftChange,
            onSubmitReview,
            onMockStoryDetect,
            showMockStoryButton,
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
  busy,
  onSubmitReview,
  onMockStoryDetect,
  showMockStoryButton,
  reviewDraft,
  onReviewDraftChange,
}: {
  step: TicketFlowStepView;
  busy: boolean;
  reviewDraft: TicketDetailsViewProps["reviewDraft"];
  onReviewDraftChange: TicketDetailsViewProps["onReviewDraftChange"];
  onSubmitReview: () => void;
  onMockStoryDetect?: () => void;
  showMockStoryButton?: boolean;
}): ReactNode {
  if (step.state !== "active") return null;

  if (step.id === "story" && showMockStoryButton && onMockStoryDetect) {
    return (
      <button
        type="button"
        onClick={onMockStoryDetect}
        disabled={busy}
        className="border-secondary/50 bg-secondary/10 text-secondary hover:bg-secondary/15 w-full rounded-xl border border-dashed px-4 py-3 text-sm font-semibold transition disabled:opacity-50"
      >
        {busy ? "Simulating…" : "Mock: story posted & detected"}
      </button>
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
