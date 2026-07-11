import { Skeleton } from "@/components/shared/Skeleton";

// Ticket details placeholder: ticket card (thumbnail + three pills +
// stepper/summary bands) above the step panel (chip + body + CTA). Built on
// the shared Skeleton primitive so it pulses like every other loading
// surface; the /60 and /40 tints keep the original depth hierarchy.
export function TicketDetailsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-md space-y-4 p-3">
      <div className="surface-card-soft ring-secondary/15 overflow-hidden ring-1">
        <div className="p-4">
          <div className="grid grid-cols-[88px_1fr] gap-2">
            <Skeleton className="h-[88px] rounded-xl" />
            <div className="flex h-[88px] flex-col gap-1.5">
              <Skeleton className="bg-muted/60 flex-1 rounded-xl" />
              <Skeleton className="bg-muted/60 flex-1 rounded-xl" />
              <Skeleton className="bg-muted/60 flex-1 rounded-xl" />
            </div>
          </div>
          <Skeleton className="bg-muted/40 mt-3 h-16 rounded-xl" />
          <Skeleton className="mt-3 h-14 rounded-xl" />
        </div>
      </div>
      <div className="surface-card space-y-3 p-4">
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-full" />
      </div>
    </div>
  );
}
