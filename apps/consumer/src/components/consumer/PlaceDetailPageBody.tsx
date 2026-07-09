"use client";

import { PlaceDetailBody } from "./PlaceDetailBody";
import { PlaceDetailPageHeader } from "./PlaceDetailPageHeader";
import type { PlaceDetail } from "@/lib/mock/place";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Client wrapper for the hard-nav /place/[id] page. Mirrors the modal
// shell's header + scroll-area layout. The outer server page
// (place/[id]/page.tsx) stays server-rendered and just hands the place
// prop down. (Save + Make reservation live inside PlaceDetailBody's
// ProfileSummary — there's no bottom action bar anymore.)
export function PlaceDetailPageBody({
  place,
  backHref = CONSUMER_ROUTES.home,
}: {
  place: PlaceDetail;
  backHref?: string;
}) {
  return (
    <div className="bg-background relative flex flex-1 flex-col overflow-hidden">
      <PlaceDetailPageHeader placeName={place.name} backHref={backHref} />
      {/*
        `min-h-0` mirrors PlaceDetailModalShell — without it the flex-1
        scroll container grows to fit content, `overflow-y-auto` never
        triggers, and the sticky tab strip can't pin against a
        non-scrolling parent. See PlaceDetailModalShell for the long form.
      */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PlaceDetailBody place={place} />
      </div>
    </div>
  );
}
