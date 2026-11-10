"use client";

// The Reservations switch (MESITA-2786/2787; its own page since MESITA-3600).
// It saves the moment it flips, as the operator's answer, so a later Enrich
// cannot reopen or close bookings (reservationsPatch). No "Mesita" prefix
// (MESITA-3588: the booking is between the guest and the place). Same row
// anatomy as Payments: mark · title and line · On/Off · switch.

import { useState } from "react";
import { CalendarCheckIcon } from "@phosphor-icons/react/dist/ssr";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";
import { updatePlace } from "@/components/place-manage/actions";
import { reservationsPatch } from "@/components/place-manage/sections/action-patches";
import { Card } from "@/components/shell/Page";
import { Switch } from "@/components/ui/config";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const MARK_ROW = "grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-4 px-5 py-3 text-sm sm:px-6";

export function ReservationsPanel() {
  const { place, setPlace } = usePlaceContext();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const on = place.reservations_enabled === true;

  async function flip() {
    setPending(true);
    setError(null);
    const r = await updatePlace(reservationsPatch(place));
    setPending(false);
    if (!r.ok) return setError(r.error);
    setPlace(r.data.place);
  }

  return (
    <>
      <Card className="flex flex-col p-0 sm:p-0">
        <ul className="divide-border divide-y">
          <li className={MARK_ROW} data-place-state="reservations">
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", on ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground")}>
              <CalendarCheckIcon size={22} weight={on ? "fill" : "regular"} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-medium">Reservations</p>
              <p className="text-muted-foreground">Guests ask for a table on Mesita; Mesita calls your phone to book it.</p>
            </div>
            <p className={cn("font-semibold whitespace-nowrap", !on && "text-muted-foreground")}>{on ? "On" : "Off"}</p>
            <Switch on={on} pending={pending} onClick={() => void flip()} label={`Reservations: ${on ? "on" : "off"}`} />
          </li>
        </ul>
      </Card>
      {error ? <p className={ERROR_BOX_CLASS}>{error}</p> : null}
    </>
  );
}
