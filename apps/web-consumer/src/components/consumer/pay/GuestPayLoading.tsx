import { Skeleton } from "@/components/shared/Skeleton";

/** A bill or a receipt in bones while it loads. */
export function GuestPayLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4" data-guest-pay="loading" aria-busy aria-label="Loading your bill">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-14 w-full rounded-2xl" />
      <Skeleton className="h-14 w-full rounded-2xl" />
      <Skeleton className="mt-auto h-12 w-full rounded-full" />
    </div>
  );
}

