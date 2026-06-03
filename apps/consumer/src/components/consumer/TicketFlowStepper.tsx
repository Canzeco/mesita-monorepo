"use client";

import { Fragment } from "react";
import {
  Banknote,
  Check,
  CreditCard,
  Instagram,
  QrCode,
  ReceiptText,
  Star,
  Wallet,
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
  story_fallback: Instagram,
  pay: Banknote,
  pay_stripe: CreditCard,
  review: Star,
  cashback: Wallet,
};

const STEP_CIRCLE_CLASS = "h-8 w-8";
const STEP_ICON_CLASS = "h-3.5 w-3.5";
const STEP_CHECK_CLASS = "h-4 w-4";

export const TICKET_STEP_ICONS = STEP_ICONS;

export function TicketFlowStepCircle({
  step,
  Icon,
}: {
  step: TicketFlowStepView;
  Icon: LucideIcon;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border",
        STEP_CIRCLE_CLASS,
        step.state === "done" &&
          "border-secondary bg-secondary text-background",
        step.state === "active" &&
          "border-foreground bg-foreground text-background",
        step.state === "upcoming" &&
          "border-border bg-background text-muted-foreground",
      )}
    >
      {step.state === "done" ? (
        <Check className={STEP_CHECK_CLASS} strokeWidth={2.5} />
      ) : (
        <Icon className={STEP_ICON_CLASS} strokeWidth={2} />
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
  labelPosition = "bottom",
}: {
  steps: TicketFlowStepView[];
  direction?: "horizontal" | "vertical";
  selectedStepId?: TicketFlowStepId;
  onSelectStep?: (stepId: TicketFlowStepId) => void;
  labelPosition?: "top" | "bottom";
}) {
  const labelsOnTop = labelPosition === "top";
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
                    "ml-4 h-5 w-0.5 shrink-0",
                    connectorDone ? "bg-secondary" : "bg-border",
                  )}
                />
              ) : null}
            </Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex w-full items-start">
      {steps.map((step, i) => {
        const Icon = STEP_ICONS[step.id];
        const isSelected = selectedStepId === step.id;
        const labelEl = (
          <StepLabel
            step={step}
            className={cn(
              "w-full truncate text-center leading-tight",
              labelsOnTop ? "text-xs" : "text-[9px] leading-none",
              onSelectStep && isSelected && "text-foreground font-semibold",
            )}
          />
        );
        const stepCol = (
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            {labelsOnTop ? labelEl : null}
            <span
              className={cn(
                onSelectStep &&
                  isSelected &&
                  "ring-secondary rounded-full ring-2 ring-offset-1",
              )}
            >
              <TicketFlowStepCircle step={step} Icon={Icon} />
            </span>
            {!labelsOnTop ? labelEl : null}
          </div>
        );

        return (
          <Fragment key={`${step.id}-${i}`}>
            {onSelectStep ? (
              <button
                type="button"
                onClick={() => onSelectStep(step.id)}
                className="min-w-0 flex-1 cursor-pointer rounded-md transition hover:opacity-80"
                aria-pressed={isSelected}
                aria-label={step.label}
              >
                {stepCol}
              </button>
            ) : (
              stepCol
            )}
            {i < steps.length - 1 ? (
              <div
                className={cn(
                  "h-0.5 w-1 shrink-0 self-center",
                  labelsOnTop ? "mb-2" : "mt-4",
                  steps[i].state === "done" ? "bg-secondary" : "bg-border",
                )}
              />
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}
