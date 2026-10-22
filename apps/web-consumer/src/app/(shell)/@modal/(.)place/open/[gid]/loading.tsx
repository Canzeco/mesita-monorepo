import { PlaceSlideOverSkeleton } from "@/components/consumer/overlay/DetailSkeletons";

// Renders INSIDE the SlideOverShell mounted by ../../layout.tsx: the opening
// screen's silhouette, "No overview yet" in Overview as OpeningGooglePlace
// draws it while the profile is created (Pato, MESITA-2701: "the
// placeholders must be similar to the page you are loading, like the
// sizes"). Without it the shell's centred spinner stood in.
export default function OpeningGooglePlaceModalLoading() {
  return <PlaceSlideOverSkeleton creating />;
}
