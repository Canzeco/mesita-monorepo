import { Skeleton } from "@/components/shared";

// /saved/reservations Suspense fallback (the Reservations bottom-tab lands
// here). Without it, hard-navving in showed the generic shell spinner
// (LoadingFill) while Home/Search/Rewards all skeleton-load — the odd tab
// out. This mirrors ReservationsPage's silhouette: the Upcoming / History
// segment control on top and the content region below, so the wait reads as
// one skeleton frame instead of a lone spinner.
export default function ReservationsLoading() {
  return (
    <div className="flex h-full flex-col">
      {/* Upcoming / History segment control. */}
      <div className="px-4 pt-4">
        <Skeleton className="h-11 w-full rounded-2xl" />
      </div>

      {/* Body region — a centered content placeholder mirroring the empty
          state's icon tile + copy block. */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 py-16">
        <Skeleton className="h-16 w-16 rounded-2xl" />
        <div className="flex w-full max-w-xs flex-col items-center gap-2">
          <Skeleton className="h-5 w-48 rounded" />
          <Skeleton className="h-3.5 w-64 rounded" />
          <Skeleton className="h-3.5 w-52 rounded" />
        </div>
      </div>
    </div>
  );
}
