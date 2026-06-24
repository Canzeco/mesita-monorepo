"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Lock, QrCode } from "lucide-react";
import { TicketBillReceipt } from "@/components/consumer/TicketBillReceipt";
import { TicketStoryFrame } from "@/components/consumer/TicketStoryFrame";
import {
  STEP_DONE_LINE,
  STEP_NOW_TITLE,
  ticketStepDummyInstructions,
  type TicketFlowStepView,
  type TicketProgressInput,
  type TicketStepCopyContext,
} from "@/lib/ticket-flow-steps";
import type { TicketBillPayload } from "@/lib/api/pay";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { cn } from "@/lib/utils";

export function TicketActionCard({
  step,
  progress,
  payload,
  ticketKind,
  capMxn,
  stepCopy,
  children,
}: {
  step: TicketFlowStepView;
  progress: TicketProgressInput;
  payload: TicketBillPayload;
  ticketKind?: string | null;
  capMxn?: number | null;
  stepCopy?: TicketStepCopyContext;
  children?: ReactNode;
}) {
  const isDone = step.state === "done";
  const isActive = step.state === "active";
  const isLocked = step.state === "upcoming";
  const tips = isActive
    ? ticketStepDummyInstructions(step.id, progress, stepCopy)
    : [];
  const showBillReceipt =
    (step.id === "bill" || step.id === "pay") &&
    !!payload.total_cents &&
    !isLocked;

  return (
    <section
      className={cn(
        "surface-card overflow-hidden",
        isActive && "ring-primary/25 ring-2",
      )}
      aria-labelledby="ticket-action-title"
    >
      <div
        className={cn(
          "px-4 py-3",
          isActive && "bg-pink-gradient text-white",
          isDone && "bg-secondary/10",
          isLocked && "bg-muted/30",
        )}
      >
        <StatusPill done={isDone} active={isActive} locked={isLocked} />
        <h2
          id="ticket-action-title"
          className={cn(
            "mt-2 text-xl leading-tight font-bold",
            isActive && "text-white",
            isDone && "text-foreground",
            isLocked && "text-muted-foreground",
          )}
        >
          {STEP_NOW_TITLE[step.id]}
        </h2>
        {isDone ? (
          <p
            className={cn(
              "mt-1 text-sm font-medium",
              isActive ? "text-white/90" : "text-secondary",
            )}
          >
            {STEP_DONE_LINE[step.id]}
          </p>
        ) : null}
      </div>

      <div className="space-y-4 p-4">
        {isLocked ? (
          <div className="bg-muted/40 flex items-start gap-3 rounded-2xl px-3 py-3">
            <Lock className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-muted-foreground text-sm leading-relaxed">
              This comes later. Finish what&apos;s highlighted in pink above
              first.
            </p>
          </div>
        ) : null}

        {isActive && tips.length > 0 ? (
          <ol className="text-foreground space-y-2 text-[15px] leading-snug">
            {tips.map((line, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="bg-primary/15 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                  {i + 1}
                </span>
                <span className="pt-0.5">{line}</span>
              </li>
            ))}
          </ol>
        ) : null}

        {step.id === "story" && !isLocked ? (
          <TicketStoryFrame
            venuePhotoUrl={payload.venue_photo_url}
            venueName={payload.venue_name}
            venueInstagramHandle={stepCopy?.venueInstagramHandle}
          />
        ) : null}

        {showBillReceipt ? (
          <TicketBillReceipt
            payload={payload}
            ticketKind={ticketKind}
            capMxn={capMxn}
            venueName={payload.venue_name}
          />
        ) : null}

        {step.id === "scan" && !isLocked ? (
          <Link
            href={CONSUMER_ROUTES.pay.qr}
            className={cn(
              "btn-primary flex items-center justify-center gap-2 py-3.5 text-base",
              !isActive && "opacity-75",
            )}
          >
            <QrCode className="h-5 w-5" />
            Show my QR code
          </Link>
        ) : null}

        {children}

        {isDone && step.id !== "bill" && !children ? (
          <p className="text-muted-foreground text-center text-sm">
            Nothing else needed for this step.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function StatusPill({
  done,
  active,
  locked,
}: {
  done: boolean;
  active: boolean;
  locked: boolean;
}) {
  if (active) {
    return (
      <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase">
        Do this now
      </span>
    );
  }
  if (done) {
    return (
      <span className="text-secondary bg-secondary/15 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase">
        Done
      </span>
    );
  }
  if (locked) {
    return (
      <span className="text-muted-foreground bg-background/80 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase">
        <Lock className="h-3 w-3" />
        Later
      </span>
    );
  }
  return null;
}
