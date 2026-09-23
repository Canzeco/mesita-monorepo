import { Skeleton } from "@/components/shared";
import { PlacePickListSkeleton } from "@/components/consumer/rewards/place-pick-skeleton";

// The New Visit page's skeleton language.
//
// NewVisitLoading is the dynamic() fallback for the whole page client AND the
// route-level fallback, so it must mirror NewVisitClient: a shrink-0 search
// header (SearchBar + the Inbox link) over a scrolling column of place rows.
// It previously drew a passport card and two ticket cards — the silhouette of
// a design this page has not had since tickets moved to THE TICKET and
// Inbox > Visits. Nothing caught it because a skeleton has no test and no
// grep signature (MESITA-1229).
//
// This module stays a LEAF on purpose: it imports Skeleton and the place-list
// skeleton leaf, never PlacePickList itself. Pulling the real list in here
// would drag its fetch layer into the statically-bundled page chunk and defeat
// the dynamic() split.
//
// TicketCardSkeleton mirrors the TicketVisitShell silhouette and is consumed
// by Inbox > Visits, which is the only surface that still stacks tickets.

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

export function NewVisitLoading() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col" aria-hidden>
      {/* Search header — same shrink-0 bordered band NewVisitClient renders:
          a h-12 rounded-full SearchBar, then the centred Inbox link. */}
      <div className="border-border bg-background/90 shrink-0 border-b px-4 pt-3 pb-2.5">
        <Skeleton className="h-12 rounded-full" />
        <div className="mt-2 flex justify-center">
          <Skeleton className="h-3.5 w-48 rounded" />
        </div>
      </div>
      {/* Scroll body — the place list, drawn by the shared leaf so this frame
          and the list's own pending frame cannot diverge. */}
      <div className="flex min-h-0 flex-1 flex-col gap-3.5 px-4 pt-4 pb-6">
        <PlacePickListSkeleton />
      </div>
    </div>
  );
}
