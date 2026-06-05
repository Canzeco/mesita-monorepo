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
}: {
  photoUrl?: string | null;
  name?: string | null;
}) {
  return (
    <div className="bg-muted relative aspect-square w-full shrink-0 overflow-hidden rounded-2xl ring-1 ring-border/60">
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={name ?? "Venue"}
          fill
          className="object-cover"
          sizes="96px"
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
  const pillBase =
    "flex min-w-0 items-center rounded-xl px-3 ring-1 ring-inset";

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
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-[104px_minmax(0,1fr)] items-stretch gap-3">
          <VenueThumbnail photoUrl={venuePhotoUrl} name={venueName} />
          <div className="grid min-w-0 grid-rows-3 gap-2">
            <div className={`${pillBase} bg-muted/50 ring-border/50`}>
              {nameEl}
            </div>
            <div
              className={`${pillBase} border-secondary/20 from-secondary/12 to-accent/10 bg-gradient-to-br ring-secondary/15`}
            >
              <p className="text-secondary truncate text-sm font-semibold">
                {rewardLabel}
              </p>
            </div>
            <div className={`${pillBase} bg-muted/40 ring-border/50`}>
              <p className="text-muted-foreground truncate text-sm font-medium tabular-nums">
                {visitDateLabel ?? "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-muted/30 rounded-2xl px-4 py-3 ring-1 ring-inset ring-border/50">
          <TicketFlowStepper
            steps={steps}
            selectedStepId={displayStepId}
            onSelectStep={stepperInteractive ? onStepSelect : undefined}
          />
        </div>

        {transactionSummary ? (
          <TicketTransactionSummary
            summary={transactionSummary}
            variant="compact"
          />
        ) : statusLine ? (
          <div className="bg-muted/40 rounded-2xl px-3.5 py-3 ring-1 ring-inset ring-border/50">
            <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
              Status summary
            </p>
            <p className="text-foreground mt-0.5 text-sm font-medium">{statusLine}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
