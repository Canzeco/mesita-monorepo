"use client";

import { Fragment } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TicketFlowStepView } from "@/lib/ticket-flow-steps";

function StepDot({
  step,
  index,
}: {
  step: TicketFlowStepView;
  index: number;
}) {
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold tabular-nums transition-colors",
        step.state === "done" &&
          "border-secondary/30 bg-secondary/15 text-secondary",
        step.state === "active" &&
          "border-transparent bg-primary text-primary-foreground",
        step.state === "upcoming" &&
          "border-border bg-muted/50 text-muted-foreground",
      )}
      aria-hidden
    >
      {step.state === "done" ? (
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
      ) : (
        <span className="leading-none">{index + 1}</span>
      )}
    </span>
  );
}

/** Compact horizontal step progress for ticket detail (below venue summary). */
export function TicketFlowProgressBar({
  steps,
}: {
  steps: TicketFlowStepView[];
}) {
  return (
    <div
      className="flex w-full items-start"
      role="list"
      aria-label="Visit progress"
    >
      {steps.map((step, i) => {
        const connectorDone = step.state === "done";

        return (
          <Fragment key={`${step.id}-${i}`}>
            <div
              className="flex min-w-0 flex-1 flex-col items-center gap-1"
              role="listitem"
              aria-current={step.state === "active" ? "step" : undefined}
            >
              <StepDot step={step} index={i} />
              <span
                className={cn(
                  "w-full truncate px-0.5 text-center text-[10px] leading-tight",
                  step.state === "active" && "text-foreground font-semibold",
                  step.state === "done" && "text-secondary font-medium",
                  step.state === "upcoming" && "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 ? (
              <div
                className={cn(
                  "mt-3.5 h-0.5 min-w-2 flex-1 shrink",
                  connectorDone ? "bg-secondary/50" : "bg-border",
                )}
                aria-hidden
              />
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}
