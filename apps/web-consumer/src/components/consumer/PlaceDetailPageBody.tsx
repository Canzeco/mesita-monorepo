"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { goBack } from "@/lib/navigate";
import { PlaceProfile } from "@mesita/place-profile";
import type { PlaceDetail } from "@/lib/place-detail";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useMeasuredPlace } from "@/lib/place-distance";
import { usePlaceScore } from "@/lib/place-score";
import { useMemberPlaceActions } from "./member-place-actions";
import { PlacePageSkeleton } from "./overlay/DetailSkeletons";

export function PlaceDetailPageBody({
  place: fetched,
  fallbackHref = CONSUMER_ROUTES.home,
}: {
  place: PlaceDetail;
  fallbackHref?: string;
}) {
  // The distance after the zone (MESITA-2644).
  const measured = useMeasuredPlace(fetched);
  // The ranking breakdown for Overview's Score box (MESITA-3319).
  const scored = usePlaceScore(measured);
  const router = useRouter();
  // Enriching once this view starts the run (MESITA-2952).
  const { place, ready, actions, sheets, social } = useMemberPlaceActions(scored);
  // Back where you came from, or Home on a cold open (lib/navigate.ts).
  const onBack = useCallback(() => goBack(router, fallbackHref), [fallbackHref, router]);

  // The route's own loading silhouette until the Wallet and reservation
  // reads are in, so the profile lands whole (MESITA-3803).
  if (!ready) return <PlacePageSkeleton />;
  return (
    <div className="bg-background relative flex flex-1 flex-col overflow-hidden">
      <PlaceProfile
        place={place}
        onBack={onBack}
        actions={actions}
        social={social}
      />
      {sheets}
    </div>
  );
}
