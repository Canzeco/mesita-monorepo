"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";
import type { StaffLifecycleStepView } from "@/lib/ticket-staff-lifecycle";

export function TicketLifecycleStepper({
  steps,
  cancelled = false,
  showHint = false,
  compact = false,
}: {
  steps: StaffLifecycleStepView[];
  cancelled?: boolean;
  showHint?: boolean;
  compact?: boolean;
}) {
  const active = steps.find((s) => s.state === "active");
  const activeIndex = steps.findIndex((s) => s.state === "active");
  const doneCount = steps.filter((s) => s.state === "done").length;

  return (
    <div className={cn("flex flex-col", compact ? "gap-1" : "gap-1.5")}>
      <div className="flex items-center gap-0.5">
        {steps.map((step, i) => (
          <Fragment key={step.id}>
            <span
              title={step.label}
              className={cn(
                "flex shrink-0 rounded-full transition-all duration-300",
                step.state === "done" &&
                  "h-1.5 w-1.5 bg-emerald-500/90 shadow-[0_0_0_1px_oklch(0.65_0.17_152/0.25)]",
                step.state === "active" &&
                  "bg-primary ring-primary/25 h-2.5 w-2.5 shadow-sm ring-2",
                step.state === "upcoming" && "bg-border/90 h-1.5 w-1.5",
              )}
            />
            {i < steps.length - 1 ? (
              <span
                className={cn(
                  "h-px shrink-0 transition-colors",
                  compact ? "w-2" : "w-2.5",
                  i < activeIndex ||
                    (activeIndex === -1 && step.state === "done")
                    ? "bg-emerald-400/60"
                    : "bg-border/70",
                )}
                aria-hidden
              />
            ) : null}
          </Fragment>
        ))}
        {cancelled ? (
          <span className="text-destructive ml-2.5 text-[11px] font-medium">
            Cancelled
          </span>
        ) : active ? (
          <span
            className={cn(
              "ml-2.5 font-medium",
              compact ? "text-muted-foreground text-[10px]" : "text-[11px]",
              active.state === "active" && !compact && "text-foreground",
            )}
          >
            {active.label}
          </span>
        ) : doneCount === steps.length ? (
          <span className="text-muted-foreground ml-2.5 text-[11px]">Done</span>
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
