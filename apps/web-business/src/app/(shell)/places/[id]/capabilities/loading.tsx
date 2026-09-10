// Capabilities is ONE tall section — PromosSection carries Offerings,
// Partnership, Visit Rewards, Visits, Orders and Reservations together — so
// the skeleton is one tall block rather than a stack of cards that would
// resolve into a single one.
import { PlaceViewSkeleton } from "@/components/console/PlaceViewSkeleton";

export default function CapabilitiesLoading() {
  return (
    <PlaceViewSkeleton
      label="Loading capabilities…"
      blocks={["h-[420px]"]}
    />
  );
}
