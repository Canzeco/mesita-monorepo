"use client";

import { TicketVisitShell } from "@/components/consumer/TicketVisitShell";
import type { TicketTransactionSummary as TicketTransactionSummaryData } from "@/lib/api/pay";
import type {
  TicketFlowStepId,
  TicketFlowStepView,
} from "@/lib/ticket-flow-steps";

/** Detail-route ticket header — uses shared visit shell layout. */
export function TicketVisitHeader({
  venueName,
  venueHref,
  venuePhotoUrl,
  rewardLabel,
  visitDateLabel,
  steps,
  displayStepId,
  onStepSelect,
  stepperInteractive = true,
  transactionSummary,
  statusLine,
}: {
  venueName: string;
  venueHref?: string | null;
  venuePhotoUrl?: string | null;
  rewardLabel: string;
  visitDateLabel?: string | null;
  steps: TicketFlowStepView[];
  displayStepId: TicketFlowStepId;
  onStepSelect?: (id: TicketFlowStepId) => void;
  stepperInteractive?: boolean;
  transactionSummary?: TicketTransactionSummaryData | null;
  statusLine?: string | null;
}) {
  return (
    <TicketVisitShell
      venueName={venueName}
      venueHref={venueHref}
      venuePhotoUrl={venuePhotoUrl}
      rewardLabel={rewardLabel}
      visitDateLabel={visitDateLabel}
      steps={steps}
      displayStepId={displayStepId}
      onStepSelect={onStepSelect}
      stepperInteractive={stepperInteractive}
      transactionSummary={transactionSummary}
      statusLine={statusLine}
    />
  );
}
