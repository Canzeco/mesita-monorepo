import { Skeleton } from "@/components/shared";

// /reservations Suspense fallback (the Reservations bottom-tab lands here).
export default function ReservationsLoading() {
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4">
        <Skeleton className="h-11 w-full rounded-2xl" />
      </div>

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
