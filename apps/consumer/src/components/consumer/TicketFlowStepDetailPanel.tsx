"use client";

import { type ReactNode } from "react";
import {
  STEP_DONE_LINE,
  ticketStepActiveInstruction,
  type TicketFlowStepView,
  type TicketProgressInput,
} from "@/lib/ticket-flow-steps";
import { cn } from "@/lib/utils";

function StepMarker({
  step,
  index,
}: {
  step: TicketFlowStepView;
  index: number;
}) {
  if (step.state === "done") {
    return (
      <span
        className="bg-secondary/15 text-secondary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
        aria-hidden
      >
        ✓
      </span>
    );
  }
  if (step.state === "active") {
    return (
      <span
        className="bg-foreground text-background flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
        aria-hidden
      >
        {index}
      </span>
    );
  }
  return (
    <span
      className="border-border text-muted-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px]"
      aria-hidden
    >
      {index}
    </span>
  );
}

export function TicketFlowStepDetailPanel({
  steps,
  progress,
  renderActiveContent,
}: {
  steps: TicketFlowStepView[];
  progress: TicketProgressInput;
  renderActiveContent?: (step: TicketFlowStepView) => ReactNode;
}) {
  return (
    <ol className="divide-border/70 divide-y">
      {steps.map((step, i) => {
        const isActive = step.state === "active";
        const isDone = step.state === "done";

        return (
          <li
            key={`${step.id}-${i}`}
            className={cn(
              "flex gap-3 py-3 first:pt-0 last:pb-0",
              isActive && "bg-muted/40 -mx-1 rounded-xl px-2",
            )}
          >
            <StepMarker step={step} index={i + 1} />
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm leading-tight font-semibold",
                  isActive && "text-foreground",
                  isDone && "text-muted-foreground",
                  !isActive && !isDone && "text-muted-foreground/70",
                )}
              >
                {step.label}
              </p>

              {isDone ? (
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {STEP_DONE_LINE[step.id]}
                </p>
              ) : null}

              {isActive ? (
                <>
                  {(() => {
                    const instruction = ticketStepActiveInstruction(
                      step.id,
                      progress,
                    );
                    return instruction ? (
                      <p className="text-muted-foreground mt-1 text-[13px] leading-snug">
                        {instruction}
                      </p>
                    ) : null;
                  })()}
                  {renderActiveContent ? (
                    <div className="mt-3">{renderActiveContent(step)}</div>
                  ) : null}
                </>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
