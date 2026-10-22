import { ReservationSlideOverSkeleton } from "@/components/consumer/overlay/DetailSkeletons";

// Renders INSIDE the SlideOverShell mounted by layout.tsx — the panel is
// already sliding in while this silhouette of the reservation waits for the
// server data (MESITA-2701: the loaded screen's blocks, at their sizes).
export default function ModalSegmentLoading() {
  return <ReservationSlideOverSkeleton />;
}
