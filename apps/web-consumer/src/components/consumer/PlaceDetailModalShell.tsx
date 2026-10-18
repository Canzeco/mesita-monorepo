"use client";

import { PlaceDetailTitle } from "@mesita/place-profile";
import { SlideOverHeader } from "@/components/consumer/overlay/SlideOverShell";
import type { PlaceDetail } from "@/lib/place-detail";

// Content chrome for the intercepted /place/[id] route. The sliding panel
// itself (enter/exit animation, backdrop, ESC, router.back on dismiss) is
// SlideOverShell, mounted by the segment's layout.tsx — this component only
// fills it with the place header and the scrollable body.
//
// decision: Pato (MESITA-392, reverses MESITA-383) — Save moved into the
// body action row; the header is just dismiss + centered name. SlideOverHeader
// renders a w-9 spacer for the absent actions slot, so the title stays centered.
// decision: Pato (MESITA-451, revised) — the "Enriching" state now lives as
// a chip in the profile summary (PlaceDetailBody), not the title row.
// decision: Pato (2026-10-17, MESITA-2321) — all five buttons sit in the
// profile summary (Save · Contact · Share / Reserve · Pay); no pinned band.
//   1. SlideOverHeader (shrink-0) — dismiss + place name
//   2. Scroll area (flex-1 overflow-y-auto) — PlaceDetailBody (ugly
//      Create profile included). Enrich is a tab until Enriched.

export function PlaceDetailModalShell({
  children,
  place,
}: {
  children: React.ReactNode;
  place: PlaceDetail;
}) {
  return (
    <>
      <SlideOverHeader
        title={
          <PlaceDetailTitle
            placeName={place.name}
            enriched={place.is_enriched}
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
