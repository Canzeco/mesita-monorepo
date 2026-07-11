"use client";

import Image from "next/image";
import { MapPin } from "lucide-react";
import { TicketFlowStepper } from "@/components/consumer/TicketFlowStepper";
import type { TicketCardView } from "@/lib/hooks/useConsumerPayTickets";

// Compact reward-ticket card for the Rewards list: image · name · time, and
// the step track. The step itself is the status — no reward amount, no status
// text, no table number. (The full detail lives in the ticket sheet on tap.)
export function RewardsTicketCard({
  view,
  onOpen,
}: {
  view: TicketCardView;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="surface-card ring-border/60 grid w-full gap-3 rounded-2xl p-3 text-left ring-1 transition active:scale-[0.995]"
    >
      <div className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-3">
        <div className="bg-muted ring-border/60 relative size-[52px] shrink-0 overflow-hidden rounded-xl ring-1">
          {view.placePhotoUrl ? (
            <Image
              src={view.placePhotoUrl}
              alt={view.placeName}
              fill
              className="object-cover"
              sizes="52px"
            />
          ) : (
            <span className="text-muted-foreground flex h-full items-center justify-center">
              <MapPin className="size-5 opacity-40" />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-foreground truncate text-[15px] font-bold tracking-tight">
            {view.placeName}
          </p>
          <p className="text-muted-foreground mt-0.5 text-[12px] tabular-nums">
            {view.timeLabel}
          </p>
        </div>
      </div>

      <div className="bg-muted/40 ring-border/50 rounded-xl px-3 py-3 ring-1 ring-inset">
        <TicketFlowStepper steps={view.steps} />
      </div>
    </button>
  );
}
