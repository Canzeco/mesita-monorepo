"use client";

import { PlaceDetailBody } from "@mesita/place-profile";
import { PlaceDetailModalShell } from "@/components/consumer/PlaceDetailModalShell";
import type { PlaceDetail } from "@/lib/place-detail";
import { useMemberPlaceActions } from "@/components/consumer/member-place-actions";
import { useMeasuredPlace } from "@/lib/place-distance";

export function MemberPlaceModal({ place: fetched }: { place: PlaceDetail }) {
  // The distance after the zone (MESITA-2644).
  const measured = useMeasuredPlace(fetched);
  // Enriching once this visit starts the run (MESITA-2952).
  const { place, actions, sheets, social, boost, openTab } = useMemberPlaceActions(measured);
  return (
    <>
      <PlaceDetailModalShell place={place} onMore={actions.onMore}>
        <PlaceDetailBody
          place={place}
          actions={actions}
          social={social}
          boost={boost}
          openTab={openTab}
        />
      </PlaceDetailModalShell>
      {sheets}
    </>
  );
}
