import { type ReactNode } from 'react';

import {
  TicketReviewForm,
  type TicketReviewDraft,
} from '@/components/rewards/TicketReviewForm';
import { Button } from '@/components/ui/Button';
import type { TicketFlowStepView } from '@/lib/ticket-flow-steps';

export function renderStepActions({
  step,
  busy,
  reviewDraft,
  onReviewDraftChange,
  onSubmitReview,
}: {
  step: TicketFlowStepView;
  busy: boolean;
  reviewDraft: TicketReviewDraft;
  onReviewDraftChange: (d: TicketReviewDraft) => void;
  onSubmitReview: () => void;
}): ReactNode {
  if (step.state !== 'active') return null;

  if (step.id === 'review') {
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
