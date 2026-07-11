import { PlaceSlideOverSkeleton } from "@/components/consumer/overlay/DetailSkeletons";

// Renders INSIDE the SlideOverShell mounted by layout.tsx — the panel is
// already sliding in while this skeleton waits for the place EF.
export default function PlaceModalLoading() {
  return <PlaceSlideOverSkeleton />;
}
