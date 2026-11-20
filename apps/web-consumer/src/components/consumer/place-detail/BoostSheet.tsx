"use client";

import {
  BoostPane,
  BoostUnavailable,
} from "@/components/consumer/place-detail/BoostPane";
import { PlaceSubpage } from "@/components/consumer/place-detail/PlaceSubpage";
import { isMesitaPlaceId } from "@/lib/api/activity";
import type { PlaceDetail } from "@/lib/place-detail";
import { usePlaceBoost } from "@/components/consumer/place-detail/use-place-boost";

// THE UPGRADE PAGE (MESITA-4111). It was a sheet (Pato, MESITA-3201: "Upgrade
// just opens a modal on top, like contact"): the Upgrade tile, More › Upgrade
// and the return from Checkout open /place/<id>/upgrade. A Google-only card
// is not a place row yet, so there is nothing to back; it says so in the
// consumer's own words (MESITA-2797).
export function PlaceUpgradePage({ place }: { place: PlaceDetail }) {
  const boost = usePlaceBoost(place.id);
  return (
    <PlaceSubpage title="Upgrade" placeName={place.name} placeId={place.id}>
      <div className="px-5 py-2">
        {isMesitaPlaceId(place.id) ? (
          <BoostPane
            place={place}
            boost={boost.data}
            loading={boost.loading}
            failed={boost.failed}
            onRetry={boost.reload}
          />
        ) : (
          <BoostUnavailable />
        )}
      </div>
    </PlaceSubpage>
  );
}
