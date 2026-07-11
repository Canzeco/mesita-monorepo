"use client";

import { PlaceHoursEditor } from "./PlaceHoursEditor";
import type { DayKey, DayShifts } from "./place-hours";

export function PlaceHoursSection({
  hours,
  onChange,
  timezone,
}: {
  hours: Record<DayKey, DayShifts>;
  onChange: (hours: Record<DayKey, DayShifts>) => void;
  timezone?: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      {timezone ? (
        <p className="text-muted-foreground text-[11px]">{timezone}</p>
      ) : null}
      <PlaceHoursEditor hours={hours} onChange={onChange} />
    </div>
  );
}
