// Activity renders PerformanceHeadline, ReputationStrip, EventSuperBoxes and
// ReservationsList in that order. Note this covers only the SERVER wait on
// `getManagePlace` — the feed itself is a client fetch inside ActivityTab,
// which shows its own Spinner afterwards.
import { PlaceViewSkeleton } from "@/components/console/PlaceViewSkeleton";

export default function ActivityLoading() {
  return (
    <PlaceViewSkeleton
      label="Loading activity…"
      blocks={["h-[88px]", "h-[72px]", "h-[132px]", "h-[220px]"]}
    />
  );
}
