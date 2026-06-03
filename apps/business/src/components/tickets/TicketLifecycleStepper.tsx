"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";
import type { StaffLifecycleStepView } from "@/lib/ticket-staff-lifecycle";

export function TicketLifecycleStepper({
  steps,
  cancelled = false,
  showHint = false,
}: {
  steps: StaffLifecycleStepView[];
  cancelled?: boolean;
  showHint?: boolean;
}) {
  const active = steps.find((s) => s.state === "active");
  const activeIndex = steps.findIndex((s) => s.state === "active");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        {steps.map((step, i) => (
          <Fragment key={step.id}>
            <span
              title={step.label}
              className={cn(
                "flex shrink-0 rounded-full transition-colors",
                step.state === "done" && "bg-emerald-500 h-1.5 w-1.5",
                step.state === "active" &&
                  "bg-foreground ring-foreground/20 h-2 w-2 ring-2",
                step.state === "upcoming" && "bg-border h-1.5 w-1.5",
              )}
            />
            {i < steps.length - 1 ? (
              <span
                className={cn(
                  "h-px w-3 shrink-0",
                  i < activeIndex ||
                    (activeIndex === -1 && step.state === "done")
                    ? "bg-emerald-400/50"
                    : "bg-border/80",
                )}
                aria-hidden
              />
            ) : null}
          </Fragment>
        ))}
        {cancelled ? (
          <span className="text-destructive ml-2 text-[11px] font-medium">
            Cancelled
          </span>
        ) : active ? (
          <span className="text-muted-foreground ml-2 text-[11px]">
            {active.label}
          </span>
        ) : null}
      </div>
      {showHint && active?.hint ? (
        <p className="text-muted-foreground text-[11px] leading-snug">
          {active.hint}
        </p>
      ) : null}
    </div>
  );
}
