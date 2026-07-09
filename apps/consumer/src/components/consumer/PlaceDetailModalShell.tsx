"use client";

import { SlideOverHeader } from "@/components/consumer/overlay/SlideOverShell";
import { PlaceMoreButton } from "@/components/consumer/PlaceDetailPageHeader";

// Content chrome for the intercepted /place/[id] route. The sliding panel
// itself (enter/exit animation, backdrop, ESC, router.back on dismiss) is
// SlideOverShell, mounted by the segment's layout.tsx — this component only
// fills it with the place header and scrollable body.
//
// decision: Pato — header is name only; verification lives in the body
// tag row. Save + Make reservation live inside PlaceDetailBody.
//   1. SlideOverHeader (shrink-0) — dismiss + place name + ⋯
//   2. Scroll area (flex-1 overflow-y-auto) — PlaceDetailBody

export function PlaceDetailModalShell({
  children,
  placeName,
  listingType: _listingType,
}: {
  children: React.ReactNode;
  placeName: string;
  listingType: "partner" | "web";
}) {
  return (
    <>
      <SlideOverHeader
        title={
          <span className="font-display truncate text-base font-semibold">
            {placeName}
          </span>
        }
        actions={<PlaceMoreButton />}
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
