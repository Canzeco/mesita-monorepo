"use client";

import { PlaceDetailBody } from "./PlaceDetailBody";
import { PlaceDetailPageHeader } from "./PlaceDetailPageHeader";
import { PlaceActionBar } from "./place-detail/PlaceActionBar";
import type { PlaceDetail } from "@/lib/mock/place";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Client wrapper for the hard-nav /place/[id] page. Mirrors the modal
// shell's three-band layout: header · scroll area · pinned action bar. The
// outer server page (place/[id]/page.tsx) stays server-rendered and just
// hands the place prop down. Save · Contact · Share scroll with the body;
// Visit · Order · Reserve are pinned (MESITA-1065).
//
// On THIS route the bar lands directly above BottomNav, so the hard-nav page
// carries two bottom bands. The intercepted modal — how you actually arrive
// here from swipe/favorites — covers BottomNav with its slide-over, so the
// bar is the only bottom chrome there.
export function PlaceDetailPageBody({
  place,
  backHref = CONSUMER_ROUTES.home,
}: {
  place: PlaceDetail;
  backHref?: string;
}) {
  return (
    <div className="bg-background relative flex flex-1 flex-col overflow-hidden">
      <PlaceDetailPageHeader
        placeId={place.id}
        placeName={place.name}
        listingType={place.listing_type}
        backHref={backHref}
      />
      {/*
        `min-h-0` mirrors PlaceDetailModalShell — without it the flex-1
        scroll container grows to fit content, `overflow-y-auto` never
        triggers, and the sticky tab strip can't pin against a
        non-scrolling parent. See PlaceDetailModalShell for the long form.
      */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PlaceDetailBody place={place} />
      </div>
      <PlaceActionBar place={place} />
    </div>
  );
}
