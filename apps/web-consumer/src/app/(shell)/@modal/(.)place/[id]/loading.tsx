import { PlaceSlideOverSkeleton } from "@/components/consumer/overlay/DetailSkeletons";

// Renders INSIDE the SlideOverShell mounted by ../layout.tsx — the panel is
// already sliding in while this silhouette of the place screen waits for the
// place EF: the loaded screen's blocks, at their sizes (Pato, MESITA-2701:
// "the placeholders must be similar to the page you are loading, like the
// sizes").
export default function PlaceModalLoading() {
  return <PlaceSlideOverSkeleton />;
}
