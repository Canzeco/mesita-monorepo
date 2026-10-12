import { Skeleton } from "@/components/shared";

// What Home's pills show while the shared deck loads: one rounded skeleton
// on the page ground (`discover-loading-fallback.test.tsx`).
export function DiscoverFallback() {
  return (
    <div className="min-h-0 flex-1 p-4">
      <Skeleton className="h-full w-full rounded-2xl" />
    </div>
  );
}
