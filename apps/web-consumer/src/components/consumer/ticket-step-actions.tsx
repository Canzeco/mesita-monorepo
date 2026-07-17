import { type ReactNode } from "react";

import {
  TicketReviewForm,
  type TicketReviewDraft,
} from "@/components/consumer/TicketReviewForm";
import type { TicketFlowStepView } from "@/lib/ticket-flow-steps";

export function renderStepActions({
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
  reviewDraft: TicketReviewDraft;
  onReviewDraftChange: (d: TicketReviewDraft) => void;
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
