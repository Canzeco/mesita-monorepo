"use client";

import { PlaceDetailBody } from "@mesita/place-profile";
import { PlaceDetailModalShell } from "@/components/consumer/PlaceDetailModalShell";
import type { PlaceDetail } from "@/lib/place-detail";
import { useMemberPlaceActions } from "@/components/consumer/member-place-actions";

export function MemberPlaceModal({ place }: { place: PlaceDetail }) {
  const { actions, sheets } = useMemberPlaceActions(place);
  return (
    <>
      <PlaceDetailModalShell place={place} onReserve={actions.onReserve}>
        <PlaceDetailBody place={place} actions={actions} />
      </PlaceDetailModalShell>
      {sheets}
    </>
  );
}
