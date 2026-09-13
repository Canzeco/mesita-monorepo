// Reviews renders the four score tiles, then the Mesita sub-scores.
import { PlaceViewSkeleton } from "@/components/console/PlaceViewSkeleton";

export default function ReviewsLoading() {
  return (
    <PlaceViewSkeleton
      label="Loading reviews…"
      blocks={["h-[132px]", "h-[96px]"]}
    />
  );
}
