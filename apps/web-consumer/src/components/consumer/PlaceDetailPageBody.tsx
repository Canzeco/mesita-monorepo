"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { PlaceProfile } from "@mesita/place-profile";
import type { PlaceDetail } from "@/lib/place-detail";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useMemberPlaceActions } from "./member-place-actions";

export function PlaceDetailPageBody({
  place,
  fallbackHref = CONSUMER_ROUTES.home,
}: {
  place: PlaceDetail;
  fallbackHref?: string;
}) {
  const router = useRouter();
  const { actions, sheets, social } = useMemberPlaceActions(place);
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
      />
      {sheets}
    </div>
  );
}
