"use client";

import { type ReactNode } from "react";
import {
  TICKET_STEP_ICONS,
  TicketFlowStepCircle,
} from "@/components/consumer/TicketFlowStepper";
import {
  ticketFlowStepAnchorId,
  ticketFlowStepStatusLabel,
  type TicketFlowStepView,
} from "@/lib/ticket-flow-steps";
import { cn } from "@/lib/utils";

function StepStatusBadge({ step }: { step: TicketFlowStepView }) {
  const label = ticketFlowStepStatusLabel(step);

  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
        step.state === "done" && "bg-secondary/15 text-secondary",
        step.state === "active" && "bg-foreground text-background",
        step.state === "upcoming" && "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

export function TicketFlowStepDetailPanel({
  steps,
  renderStepDetail,
}: {
  steps: TicketFlowStepView[];
  renderStepDetail: (step: TicketFlowStepView) => ReactNode;
}) {
  return (
    <div className="space-y-0">
      {steps.map((step, i) => {
        const Icon = TICKET_STEP_ICONS[step.id];
        const isLast = i === steps.length - 1;
        const isActive = step.state === "active";

        return (
          <div
            key={`${step.id}-${i}`}
            id={ticketFlowStepAnchorId(step.id)}
            className="scroll-mt-4 flex gap-3"
          >
            <div className="relative w-8 shrink-0 self-stretch">
              <div className="absolute top-0.5 left-1/2 z-10 -translate-x-1/2">
                <TicketFlowStepCircle step={step} Icon={Icon} />
              </div>
              {!isLast ? (
                <div
                  className={cn(
                    "absolute top-9 bottom-0 left-1/2 w-0.5 -translate-x-1/2",
                    step.state === "done" ? "bg-secondary" : "bg-border",
                  )}
                  aria-hidden
                />
              ) : null}
            </div>

            <div
              className={cn(
                "min-w-0 flex-1",
                !isLast && "pb-6",
                isActive &&
                  "border-secondary/25 bg-secondary/[0.06] rounded-xl border px-3 py-3",
                !isActive && "pt-0.5",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p
                  className={cn(
                    "text-[15px] leading-tight font-semibold",
                    step.state === "active" && "text-foreground",
                    step.state === "done" && "text-secondary",
                    step.state === "upcoming" && "text-muted-foreground",
                  )}
                >
                  {step.label}
                </p>
                <StepStatusBadge step={step} />
              </div>
              <div className={cn("mt-2", !isActive && "mt-1.5")}>
                {renderStepDetail(step)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
