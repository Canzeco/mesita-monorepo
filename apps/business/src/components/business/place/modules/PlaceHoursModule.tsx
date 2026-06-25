import type { MyVenue } from "@/lib/api/venues";
import { PlaceHoursSection } from "../PlaceHoursSection";
import { PlaceModule } from "../PlaceModule";
import type { DayKey, DayShifts } from "../place-hours";

export function PlaceHoursModule({
  venue,
  hours,
  onChange,
}: {
  venue: MyVenue;
  hours: Record<DayKey, DayShifts>;
  onChange: (hours: Record<DayKey, DayShifts>) => void;
}) {
  return (
    <PlaceModule id="hours">
      <PlaceHoursSection
        hours={hours}
        onChange={onChange}
        timezone={venue.timezone}
      />
    </PlaceModule>
  );
}
