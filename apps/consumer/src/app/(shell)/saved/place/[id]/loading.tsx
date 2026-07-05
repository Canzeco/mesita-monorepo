import { PlaceBodySkeleton } from "@/components/consumer/overlay/DetailSkeletons";
import { Skeleton } from "@/components/shared/Skeleton";

// Hard-nav place page: in-band skeleton in the shell body (chrome stays put).
export default function PlacePageLoading() {
  return (
    <div className="h-full min-h-0 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="mx-auto h-4 w-32" />
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
      <PlaceBodySkeleton />
    </div>
  );
}
