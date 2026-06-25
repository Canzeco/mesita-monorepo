import type { MyVenue } from "@/lib/api/venues";
import { PlaceDetailsSection } from "../PlaceDetailsSection";
import { PlaceModule } from "../PlaceModule";

export function PlaceDetailsModule({ venue }: { venue: MyVenue }) {
  return (
    <PlaceModule id="details">
      <PlaceDetailsSection venue={venue} />
    </PlaceModule>
  );
}
