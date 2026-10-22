import { PlaceSlideOverSkeleton } from "@/components/consumer/overlay/DetailSkeletons";

// Renders INSIDE the SlideOverShell mounted by ../layout.tsx — the panel is
// already sliding in while this silhouette of the place screen waits for the
// place EF (MESITA-2701: the loaded screen's blocks, at their sizes).
export default function PlaceModalLoading() {
  return <PlaceSlideOverSkeleton />;
}
