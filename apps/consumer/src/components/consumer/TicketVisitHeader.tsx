"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { TicketFlowStepper } from "@/components/consumer/TicketFlowStepper";
import type {
  TicketFlowStepId,
  TicketFlowStepView,
} from "@/lib/ticket-flow-steps";

export function TicketVisitHeader({
  venueTitle,
  venueHref,
  venuePhotoUrl,
  venueName,
  rewardLabel,
  steps,
  displayStepId,
  onStepSelect,
  statusLine,
  stepperInteractive = true,
}: {
  venueTitle: string;
  venueHref: string | null;
  venuePhotoUrl?: string | null;
  venueName?: string | null;
  rewardLabel: string;
  steps: TicketFlowStepView[];
  displayStepId: TicketFlowStepId;
  onStepSelect?: (id: TicketFlowStepId) => void;
  statusLine?: string | null;
  stepperInteractive?: boolean;
}) {
  return (
    <header className="surface-card-soft overflow-hidden">
      <div className="flex gap-3 p-4">
        <div className="bg-muted relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl ring-1 ring-border/50">
          {venuePhotoUrl ? (
            <Image
              src={venuePhotoUrl}
              alt={venueName ?? "Venue"}
              fill
              className="object-cover"
              sizes="64px"
            />
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center">
              <MapPin className="h-5 w-5 opacity-40" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          {venueHref ? (
            <Link
              href={venueHref}
              className="text-foreground line-clamp-2 text-base font-semibold leading-snug hover:opacity-80"
            >
              {venueTitle}
            </Link>
          ) : (
            <p className="text-foreground line-clamp-2 text-base font-semibold leading-snug">
              {venueTitle}
            </p>
          )}
          <p className="text-secondary mt-1 text-sm font-medium">{rewardLabel}</p>
          {statusLine ? (
            <p className="text-muted-foreground mt-1 text-xs leading-snug">
              {statusLine}
            </p>
          ) : null}
        </div>
      </div>
      <div className="border-border/50 border-t px-3 pb-4 pt-3">
        <TicketFlowStepper
          steps={steps}
          selectedStepId={displayStepId}
          onSelectStep={stepperInteractive ? onStepSelect : undefined}
          labelPosition="top"
        />
      </div>
    </header>
  );
}
