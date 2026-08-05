"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { getPlaceActivity, type PlaceActivity } from "../../actions";
import { ReservationsList } from "../../sections/ReservationsList";
import { Spinner } from "../../ui";
import { useUnitPlace } from "../../UnitPlaceContext";

// Reservations tab (MESITA-894) — Mesita Reservationist bookings only.
// Read-only list + AI dial lines. Channel routing stays on Settings.
export default function UnitReservationsPage() {
  const { place } = useUnitPlace();
  const [activity, setActivity] = useState<PlaceActivity | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // Dedicated tab — pull a fuller list than Performance's old embedded card.
    getPlaceActivity(place.id, { limit: 50 }).then((r) => {
      if (!alive) return;
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setActivity(r.data);
    });
    return () => {
      alive = false;
    };
  }, [place.id]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 pb-10">
      {error ? (
        <div className="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-3 rounded-2xl border p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Couldn&apos;t load reservations.</p>
            <p className="mt-1 opacity-90">{error}</p>
          </div>
        </div>
      ) : activity ? (
        <ReservationsList activity={activity} />
      ) : (
        <Spinner label="Loading…" />
      )}
    </div>
  );
}
