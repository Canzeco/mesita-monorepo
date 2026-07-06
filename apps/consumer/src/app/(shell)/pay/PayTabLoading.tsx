import { Skeleton } from "@/components/shared/Skeleton";

// The Rewards page's ONE skeleton language. PayTabLoading is the dynamic()
// fallback for the whole page client (banner + passport card + tickets);
// TicketCardSkeleton mirrors the TicketVisitShell silhouette and is reused
// by PayTickets' pending state and PayClient's tickets fallback, so every
// loading frame on this page looks like the content it becomes.
//
// This module stays a leaf (Skeleton only) on purpose: both PayClient and
// PayTickets import from it, and pulling anything heavier in here would
// drag the ticket stack into the statically-bundled page chunk and defeat
// the dynamic() splits.

/** Placeholder matching TicketVisitShell: thumbnail + 3 pills + stepper band. */
export function TicketCardSkeleton() {
  return (
    <div className="surface-card-soft ring-secondary/15 overflow-hidden ring-1">
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-[104px_minmax(0,1fr)] items-stretch gap-3">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="grid min-w-0 grid-rows-3 gap-2">
            <Skeleton className="rounded-xl" />
            <Skeleton className="rounded-xl" />
            <Skeleton className="rounded-xl" />
          </div>
        </div>
        <Skeleton className="h-14 rounded-2xl" />
      </div>
    </div>
  );
}

/** Tickets list placeholder: section header line + two ticket cards. */
export function PayTicketListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-24" />
      </div>
      <TicketCardSkeleton />
      <TicketCardSkeleton />
    </div>
  );
}

export function PayTabLoading() {
  // Silhouette of the single Rewards page: explainer banner, the Mesita
  // passport card (QR square), then the tickets stack. The per-section
  // skeletons take over once the client mounts.
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col px-4 pt-4 pb-6">
      {/* Rewards explainer banner (RewardsInfoBanner) */}
      <Skeleton className="h-[92px] rounded-2xl" />
      {/* Mesita passport card (MyQrCard) */}
      <Skeleton className="mt-3 h-[300px] rounded-[24px]" />
      {/* Tickets stack */}
      <div className="mt-4">
        <PayTicketListSkeleton />
      </div>
    </div>
  );
}
