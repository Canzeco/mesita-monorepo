import { PlacePageSkeleton } from "@/components/consumer/overlay/DetailSkeletons";

// Hard-nav place page: the place screen's own silhouette in the shell body,
// block for block where PlaceDetailPageBody draws it (Pato, MESITA-2701: "the
// placeholders must be similar to the page you are loading, like the sizes").
export default function PlacePageLoading() {
  return <PlacePageSkeleton />;
}
