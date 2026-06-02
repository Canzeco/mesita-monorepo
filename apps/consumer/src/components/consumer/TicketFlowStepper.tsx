"use client";

import {
  Check,
  CreditCard,
  Instagram,
  ReceiptText,
  RotateCcw,
  ShieldAlert,
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
  story: Instagram,
  bill: ReceiptText,
  story_fallback: RotateCcw,
  pay: CreditCard,
  pay_stripe: CreditCard,
  story_vuln: ShieldAlert,
  cashback: Wallet,
  review: Star,
};

export function TicketFlowStepper({ steps }: { steps: TicketFlowStepView[] }) {
  const compact = steps.length > 4;

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div className="flex min-w-max items-center">
        {steps.map((step, i) => {
          const Icon = STEP_ICONS[step.id];

          return (
            <div key={`${step.id}-${i}`} className="contents">
              <div
                className={cn(
                  "flex flex-col items-center gap-1.5",
                  compact ? "w-[52px]" : "w-[58px]",
                )}
              >
                <span
                  className={cn(
                    "flex items-center justify-center rounded-full border",
                    compact ? "h-7 w-7" : "h-8 w-8",
                    step.state === "done" &&
                      "border-secondary bg-secondary text-background",
                    step.state === "active" &&
                      "border-foreground bg-foreground text-background",
                    step.state === "upcoming" &&
                      "border-border bg-background text-muted-foreground",
                  )}
                >
                  {step.state === "done" ? (
                    <Check
                      className={compact ? "h-3.5 w-3.5" : "h-4 w-4"}
                      strokeWidth={2.5}
                    />
                  ) : (
                    <Icon
                      className={compact ? "h-3 w-3" : "h-3.5 w-3.5"}
                      strokeWidth={2}
                    />
                  )}
                </span>
                <span
                  className={cn(
                    "max-w-full truncate text-center leading-none",
                    compact ? "text-[9px]" : "text-[10px]",
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
                    "mb-4 h-0.5",
                    compact ? "w-3" : "w-4",
                    steps[i].state === "done" ? "bg-secondary" : "bg-border",
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
