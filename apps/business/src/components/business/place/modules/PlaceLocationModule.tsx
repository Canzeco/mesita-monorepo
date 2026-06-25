import type { MyVenue } from "@/lib/api/venues";
import { PlaceLocationFields } from "../PlaceLocationFields";
import { PlaceModule } from "../PlaceModule";

export function PlaceLocationModule({ venue }: { venue: MyVenue }) {
  return (
    <PlaceModule id="location">
      <PlaceLocationFields venue={venue} />
    </PlaceModule>
  );
}
