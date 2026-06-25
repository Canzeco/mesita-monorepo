import type { MyVenue } from "@/lib/api/venues";
import { VenueReviewsPanel } from "@/components/business/stats/VenueReviewsPanel";
import { PlaceModule } from "../PlaceModule";

export function PlaceReviewsModule({
  venue,
  hideHeader = false,
}: {
  venue: MyVenue;
  hideHeader?: boolean;
}) {
  return (
    <PlaceModule id="reviews" hideHeader={hideHeader}>
      <VenueReviewsPanel venue={venue} />
    </PlaceModule>
  );
}
