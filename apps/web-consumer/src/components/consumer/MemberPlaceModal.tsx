"use client";

import { PlaceDetailBody } from "@mesita/place-profile";
import { PlaceDetailModalShell } from "@/components/consumer/PlaceDetailModalShell";
import type { PlaceDetail } from "@/lib/place-detail";
import { useMemberPlaceActions } from "@/components/consumer/member-place-actions";
import { PlaceSlideOverSkeleton } from "@/components/consumer/overlay/DetailSkeletons";
import { useMeasuredPlace } from "@/lib/place-distance";
import { usePlaceScore } from "@/lib/place-score";

export function MemberPlaceModal({ place: fetched }: { place: PlaceDetail }) {
  // The distance after the zone (MESITA-2644).
  const measured = useMeasuredPlace(fetched);
  // The ranking breakdown for Overview's Score box (MESITA-3319).
  const scored = usePlaceScore(measured);
  // Enriching once this view starts the run (MESITA-2952).
  const { place, ready, actions, sheets, social } = useMemberPlaceActions(scored);
  // The route's own loading silhouette until the Wallet and reservation
  // reads are in, so the profile lands whole (MESITA-3803).
  if (!ready) return <PlaceSlideOverSkeleton />;
  return (
    <>
      <PlaceDetailModalShell place={place} onMore={actions.onMore}>
        <PlaceDetailBody
          place={place}
          actions={actions}
          social={social}
        />
      </PlaceDetailModalShell>
      {sheets}
    </>
  );
}
