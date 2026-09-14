// Admin is super-admin only and 404s for everyone else — but the 404 verdict
// costs the same `getManagePlace` round trip as a hit does, so the wait is
// real for both and the boundary is not optional for either.
import { PlaceViewSkeleton } from "@/components/console/PlaceViewSkeleton";

export default function AdminLoading() {
  return (
    <PlaceViewSkeleton
      label="Loading admin…"
      blocks={["h-[132px]", "h-[132px]", "h-[132px]"]}
    />
  );
}
