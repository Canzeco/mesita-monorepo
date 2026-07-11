"use client";

import { PlaceDetailTitle } from "@/components/consumer/PlaceDetailTitle";
import { SlideOverHeader } from "@/components/consumer/overlay/SlideOverShell";

// Content chrome for the intercepted /place/[id] route. The sliding panel
// itself (enter/exit animation, backdrop, ESC, router.back on dismiss) is
// SlideOverShell, mounted by the segment's layout.tsx — this component only
// fills it with the place header and scrollable body.
//
// decision: Pato (MESITA-392, reverses MESITA-383) — Save moved into the
// body action row (Save · Contact · Reserve · Share); the header is just
// dismiss + centered name. SlideOverHeader renders a w-9 spacer for the
// absent actions slot, so the title stays centered.
// decision: Pato (MESITA-451) — enriching badge lives in the title row.
//   1. SlideOverHeader (shrink-0) — dismiss + place name [(Enriching)]
//   2. Scroll area (flex-1 overflow-y-auto) — PlaceDetailBody

export function PlaceDetailModalShell({
  children,
  placeId: _placeId,
  placeName,
  listingType: _listingType,
  isEnriching = false,
}: {
  children: React.ReactNode;
  placeId: string;
  placeName: string;
  listingType: "partner" | "web";
  isEnriching?: boolean;
}) {
  return (
    <>
      <SlideOverHeader
        title={
          <PlaceDetailTitle
            placeName={placeName}
            isEnriching={isEnriching}
            className="flex-none"
          />
        }
      />
      {/*
        `min-h-0` is the load-bearing class here: without it, a flex-1 child
        keeps its default `min-height: auto` (= content size) and grows to
        fit the whole PlaceDetailBody — `overflow-y-auto` then never
        triggers, the page scrolls on the outer body instead, and
        `position: sticky top-0` on the tab strip ends up anchored to a
        scroll container that isn't actually scrolling.
      */}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </>
  );
}
