"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { PlaceProfile } from "@mesita/place-profile";
import type { PlaceDetail } from "@/lib/place-detail";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useMeasuredPlace } from "@/lib/place-distance";
import { useMemberPlaceActions } from "./member-place-actions";

export function PlaceDetailPageBody({
  place: fetched,
  fallbackHref = CONSUMER_ROUTES.home,
}: {
  place: PlaceDetail;
  fallbackHref?: string;
}) {
  // The distance after the zone (MESITA-2644).
  const measured = useMeasuredPlace(fetched);
  const router = useRouter();
  // Enriching once this view starts the run (MESITA-2952).
  const { place, actions, sheets, social, boost, openTab } = useMemberPlaceActions(measured);
  const onBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.replace(fallbackHref);
  }, [fallbackHref, router]);

  return (
    <div className="bg-background relative flex flex-1 flex-col overflow-hidden">
      <style>{`nav[data-shell-nav]{display:none}`}</style>
      <PlaceProfile
        place={place}
        onBack={onBack}
        actions={actions}
        social={social}
        boost={boost}
        openTab={openTab}
      />
      {sheets}
    </div>
  );
}
