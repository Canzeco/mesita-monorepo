import type { MyPlace } from "@/lib/api/places";
import { PlaceReviewsPanel } from "@/components/business/stats/PlaceReviewsPanel";
import { PlaceModule } from "../PlaceModule";

export function PlaceReviewsModule({ place }: { place: MyPlace }) {
  return (
    <PlaceModule id="reviews" hideHeader>
      <PlaceReviewsPanel place={place} />
    </PlaceModule>
  );
}
