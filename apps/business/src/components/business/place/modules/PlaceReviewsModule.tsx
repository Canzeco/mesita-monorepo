import type { MyPlace } from "@/lib/api/places";
import { PlaceReviewsPanel } from "@/components/business/stats/PlaceReviewsPanel";
import { PlaceModule } from "../PlaceModule";

export function PlaceReviewsModule({
  place,
  hideHeader = false,
}: {
  place: MyPlace;
  hideHeader?: boolean;
}) {
  return (
    <PlaceModule id="reviews" hideHeader={hideHeader}>
      <PlaceReviewsPanel place={place} />
    </PlaceModule>
  );
}
