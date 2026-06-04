"use client";

import { Fragment } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TicketFlowStepView } from "@/lib/ticket-flow-steps";

function StepDot({
  step,
  index,
  selected,
}: {
  step: TicketFlowStepView;
  index: number;
  selected?: boolean;
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
        selected && "ring-primary/40 ring-2 ring-offset-2 ring-offset-background",
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
  selectedStepId,
  onSelectStep,
}: {
  steps: TicketFlowStepView[];
  selectedStepId?: string;
  onSelectStep?: (stepId: TicketFlowStepView["id"]) => void;
}) {
  return (
    <div
      className="flex w-full items-start"
      role="list"
      aria-label="Visit progress"
    >
      {steps.map((step, i) => {
        const connectorDone = step.state === "done";
        const navigable = step.state === "done" || step.state === "active";
        const selected = selectedStepId === step.id;
        const stepCol = (
          <>
              <StepDot step={step} index={i} selected={selected} />
              <span
                className={cn(
                  "w-full truncate px-0.5 text-center text-[10px] leading-tight",
                  selected && "text-foreground font-semibold",
                  !selected && step.state === "active" && "text-foreground font-medium",
                  !selected && step.state === "done" && "text-secondary",
                  step.state === "upcoming" && "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
          </>
        );

        return (
          <Fragment key={`${step.id}-${i}`}>
            {navigable && onSelectStep ? (
              <button
                type="button"
                onClick={() => onSelectStep(step.id)}
                className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg py-0.5 transition hover:bg-muted/50"
                aria-current={selected ? "step" : undefined}
                aria-label={`${step.label} — ${step.state}`}
              >
                {stepCol}
              </button>
            ) : (
              <div
                className="flex min-w-0 flex-1 flex-col items-center gap-1"
                role="listitem"
                aria-current={step.state === "active" ? "step" : undefined}
              >
                {stepCol}
              </div>
            )}
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
