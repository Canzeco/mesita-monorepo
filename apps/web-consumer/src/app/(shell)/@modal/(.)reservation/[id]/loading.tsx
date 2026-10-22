import { ReservationSlideOverSkeleton } from "@/components/consumer/overlay/DetailSkeletons";

// Renders INSIDE the SlideOverShell mounted by layout.tsx — the panel is
// already sliding in while this silhouette of the reservation waits for the
// server data: the real ReservationDetailModalShell around the loaded
// screen's blocks, at their sizes (Pato, MESITA-2701: "the placeholders must
// be similar to the page you are loading, like the sizes").
export default function ModalSegmentLoading() {
  return <ReservationSlideOverSkeleton />;
}
