"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { TicketFlowStepper } from "@/components/consumer/TicketFlowStepper";
import { TicketTransactionSummary } from "@/components/consumer/TicketTransactionSummary";
import type { TicketTransactionSummary as TicketTransactionSummaryData } from "@/lib/api/pay";
import type {
  TicketFlowStepId,
  TicketFlowStepView,
} from "@/lib/ticket-flow-steps";

function VenueThumbnail({
  photoUrl,
  name,
  size = 88,
}: {
  photoUrl?: string | null;
  name?: string | null;
  size?: number;
}) {
  return (
    <div
      className="bg-muted relative shrink-0 overflow-hidden rounded-xl ring-1 ring-border/60"
      style={{ width: size, height: size }}
    >
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={name ?? "Venue"}
          fill
          className="object-cover"
          sizes={`${size}px`}
        />
      ) : (
        <div className="text-muted-foreground flex h-full items-center justify-center">
          <MapPin className="h-6 w-6 opacity-40" />
        </div>
      )}
    </div>
  );
}

/** Ticket card layout: image + name/reward/date, steps, status summary. */
export function TicketVisitShell({
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
  displayStepId?: TicketFlowStepId;
  onStepSelect?: (id: TicketFlowStepId) => void;
  stepperInteractive?: boolean;
  transactionSummary?: TicketTransactionSummaryData | null;
  statusLine?: string | null;
}) {
  const nameEl = venueHref ? (
    <Link
      href={venueHref}
      className="text-foreground truncate text-sm font-semibold hover:opacity-80"
    >
      {venueName}
    </Link>
  ) : (
    <p className="text-foreground truncate text-sm font-semibold">{venueName}</p>
  );

  return (
    <section className="surface-card-soft overflow-hidden ring-1 ring-secondary/15">
      <div className="p-4">
        <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
          <VenueThumbnail photoUrl={venuePhotoUrl} name={venueName} />
          <div className="flex h-[88px] min-w-0 flex-col gap-1.5">
            <div className="bg-muted/50 flex min-h-0 flex-1 items-center rounded-xl px-3 ring-1 ring-border/50">
              {nameEl}
            </div>
            <div className="reward-highlight min-h-0 flex-1 items-center py-1.5">
              <p className="text-secondary line-clamp-2 text-xs leading-snug font-semibold sm:text-sm">
                {rewardLabel}
              </p>
            </div>
            <div className="bg-muted/40 flex min-h-0 flex-1 items-center rounded-xl px-3 ring-1 ring-border/50">
              <p className="text-muted-foreground truncate text-xs font-medium tabular-nums sm:text-sm">
                {visitDateLabel ?? "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-muted/30 mt-3 rounded-xl px-2 py-3 ring-1 ring-border/50 sm:px-3">
          <TicketFlowStepper
            steps={steps}
            selectedStepId={displayStepId}
            onSelectStep={stepperInteractive ? onStepSelect : undefined}
            labelPosition="top"
          />
        </div>

        {transactionSummary ? (
          <TicketTransactionSummary
            summary={transactionSummary}
            variant="compact"
            className="mt-3"
          />
        ) : statusLine ? (
          <div className="bg-muted/40 mt-3 rounded-xl px-3 py-2.5 ring-1 ring-border/50">
            <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
              Status
            </p>
            <p className="text-foreground mt-0.5 text-sm font-medium">{statusLine}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
