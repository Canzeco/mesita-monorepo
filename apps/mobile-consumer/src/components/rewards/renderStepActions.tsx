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
  onMockStoryDetect,
  showMockStoryButton,
}: {
  step: TicketFlowStepView;
  busy: boolean;
  reviewDraft: TicketReviewDraft;
  onReviewDraftChange: (d: TicketReviewDraft) => void;
  onSubmitReview: () => void;
  onMockStoryDetect?: () => void;
  showMockStoryButton?: boolean;
}): ReactNode {
  if (step.state !== 'active') return null;

  if (step.id === 'story' && showMockStoryButton && onMockStoryDetect) {
    return (
      <Button
        variant="outline"
        onPress={onMockStoryDetect}
        disabled={busy}
        loading={busy}
        accessibilityLabel="Mock: story posted and detected"
      >
        Mock: story posted & detected
      </Button>
    );
  }

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
