import { PlacePageSkeleton } from "@/components/consumer/overlay/DetailSkeletons";

// Hard twin of the opening slide-over (MESITA-2311) while the route loads:
// the page's column, then the place screen's silhouette with the "No
// overview yet" screen OpeningGooglePlace shows while the profile is
// created (MESITA-2701: the loaded screen's blocks, at their sizes). It was
// the shell's centred spinner.
export default function OpeningGooglePlaceLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PlacePageSkeleton creating />
    </div>
  );
}
