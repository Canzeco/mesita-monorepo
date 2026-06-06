"use client";

import { Fragment } from "react";
import {
  Banknote,
  Check,
  CreditCard,
  Gift,
  Instagram,
  QrCode,
  ReceiptText,
  Star,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  TicketFlowStepId,
  TicketFlowStepView,
} from "@/lib/ticket-flow-steps";

const STEP_ICONS: Record<TicketFlowStepId, LucideIcon> = {
  scan: QrCode,
  bill: ReceiptText,
  story: Instagram,
  pay: Banknote,
  pay_stripe: CreditCard,
  review: Star,
  reward: Gift,
};

export const TICKET_STEP_ICONS = STEP_ICONS;

/**
 * One round step indicator, NU-verification style:
 * done = green check · active = pink gradient + step icon · upcoming = gray + lock.
 */
export function TicketFlowStepCircle({
  step,
  Icon,
  selected,
}: {
  step: TicketFlowStepView;
  Icon: LucideIcon;
  selected?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors",
        step.state === "done" &&
          "border-transparent bg-emerald-500 text-white shadow-sm",
        step.state === "active" &&
          "border-transparent bg-pink-gradient text-white shadow-glow",
        step.state === "upcoming" &&
          "border-border/80 bg-muted/50 text-muted-foreground",
        selected &&
          "ring-secondary/50 ring-2 ring-offset-2 ring-offset-background",
      )}
    >
      {step.state === "done" ? (
        <Check className="h-4 w-4" strokeWidth={2.5} />
      ) : (
        <Icon className="h-4 w-4" strokeWidth={2} />
      )}
    </span>
  );
}

function StepLabel({
  step,
  className,
}: {
  step: TicketFlowStepView;
  className?: string;
}) {
  return (
    <span
      className={cn(
        className,
        step.state === "active" && "text-foreground font-semibold",
        step.state === "done" && "text-secondary font-medium",
        step.state === "upcoming" && "text-muted-foreground",
      )}
    >
      {step.label}
    </span>
  );
}

export function TicketFlowStepper({
  steps,
  direction = "horizontal",
  selectedStepId,
  onSelectStep,
}: {
  steps: TicketFlowStepView[];
  direction?: "horizontal" | "vertical";
  selectedStepId?: TicketFlowStepId;
  onSelectStep?: (stepId: TicketFlowStepId) => void;
}) {
  if (direction === "vertical") {
    return (
      <div className="flex flex-col">
        {steps.map((step, i) => {
          const Icon = STEP_ICONS[step.id];
          const connectorDone = step.state === "done";

          return (
            <Fragment key={`${step.id}-${i}`}>
              <div className="flex items-center gap-3">
                <TicketFlowStepCircle step={step} Icon={Icon} />
                <StepLabel step={step} className="text-sm leading-none" />
              </div>
              {i < steps.length - 1 ? (
                <div
                  className={cn(
                    "ml-[15px] h-5 w-0.5 shrink-0",
                    connectorDone ? "bg-emerald-500" : "bg-border",
                  )}
                />
              ) : null}
            </Fragment>
          );
        })}
      </div>
    );
  }

  // Horizontal: a single continuous track. The whole journey at a glance.
  return (
    <div
      className="flex w-full items-center"
      role="list"
      aria-label="Visit progress"
    >
      {steps.map((step, i) => {
        const Icon = STEP_ICONS[step.id];
        const isSelected = selectedStepId === step.id;
        const canSelect =
          onSelectStep && (step.state === "done" || step.state === "active");
        const circle = (
          <TicketFlowStepCircle step={step} Icon={Icon} selected={isSelected} />
        );

        return (
          <Fragment key={`${step.id}-${i}`}>
            {canSelect ? (
              <button
                type="button"
                onClick={() => onSelectStep(step.id)}
                className="shrink-0 cursor-pointer rounded-full transition hover:opacity-80"
                aria-current={isSelected ? "step" : undefined}
                aria-label={`${step.label} — ${step.state}`}
              >
                {circle}
              </button>
            ) : (
              <span
                className="shrink-0"
                role="listitem"
                aria-current={step.state === "active" ? "step" : undefined}
                aria-label={`${step.label} — ${step.state}`}
              >
                {circle}
              </span>
            )}
            {i < steps.length - 1 ? (
              <span
                className={cn(
                  "h-[3px] flex-1 rounded-full transition-colors",
                  step.state === "done" ? "bg-emerald-500" : "bg-border",
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
