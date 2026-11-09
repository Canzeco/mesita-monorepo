"use client";

import { useState } from "react";
import { usePlaceContext } from "../PlaceContext";
import { updatePlace } from "../actions";
import { reservationsPatch } from "./action-patches";
import { Card } from "@/components/shell/Page";
import { Switch } from "@/components/ui/config";

// Settings' Actions card (MESITA-2786, toggles MESITA-2787, moved from Profile
// by MESITA-3236). Staff only: the switches are Mesita's, and
// business-web-update-place refuses them from an owner. It reads the live place
// from PlaceContext, so a flip survives moving between tabs. Reservations saves
// the moment it flips; the save stores it as the operator's answer so a later
// Enrich cannot reopen or close bookings. Prepayments saves the moment it flips
// too (MESITA-3098): on, the place screen's Mesita Prepay sells a balance at
// this place. Reservations has no "Mesita" prefix (MESITA-3588, Main §10:
// the booking is between the guest and the place); the locked "Mesita
// Payments Enabled" row went — the real switch is Business › Payments.

const ROW = "flex min-h-14 items-center justify-between gap-4 px-5 py-3 text-sm sm:px-6";

export function ActionStatesCard() {
  const { place, setPlace } = usePlaceContext();
  const [pending, setPending] = useState<"reservations" | "prepay" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(which: "reservations" | "prepay", patch: Parameters<typeof updatePlace>[0]) {
    setPending(which);
    setError(null);
    const r = await updatePlace(patch);
    setPending(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setPlace(r.data.place);
  }

  return (
    <Card className="flex flex-col p-0 sm:p-0">
      <h2 className="px-5 pt-4 pb-2 font-semibold sm:px-6">Actions</h2>
      <ul className="divide-border divide-y">
        <li className={ROW}>
          <span className="font-medium">Reservations</span>
          <Switch
            on={place.reservations_enabled === true}
            pending={pending === "reservations"}
            onClick={() => void save("reservations", reservationsPatch(place))}
            label="Reservations"
          />
        </li>
        {error ? <li className={`${ROW} text-destructive`}>{error}</li> : null}
      </ul>
    </Card>
  );
}
