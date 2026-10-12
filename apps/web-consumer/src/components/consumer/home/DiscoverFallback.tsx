import { Skeleton } from "@/components/shared";

// What Home's two pills, Swipe and Favs, show while the shared deck loads.
// Both are card layouts on the page ground, so one rounded skeleton fits both
// (`discover-loading-fallback.test.tsx`). Scroll's ink block left with Scroll
// (MESITA-2163).
export function DiscoverFallback() {
  return (
    <div className="min-h-0 flex-1 p-4">
      <Skeleton className="h-full w-full rounded-2xl" />
    </div>
  );
}
