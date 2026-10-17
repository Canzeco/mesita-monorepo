"use client";

import { PlaceActionBar, PlaceDetailTitle } from "@mesita/place-profile";
import { SlideOverHeader } from "@/components/consumer/overlay/SlideOverShell";
import type { PlaceDetail } from "@/lib/place-detail";

// Content chrome for the intercepted /place/[id] route. The sliding panel
// itself (enter/exit animation, backdrop, ESC, router.back on dismiss) is
// SlideOverShell, mounted by the segment's layout.tsx — this component only
// fills it with the place header, scrollable body and pinned action bar.
//
// decision: Pato (MESITA-392, reverses MESITA-383) — Save moved into the
// body action row; the header is just dismiss + centered name. SlideOverHeader
// renders a w-9 spacer for the absent actions slot, so the title stays centered.
// decision: Pato (MESITA-451, revised) — the "Enriching" state now lives as
// a chip in the profile summary (PlaceDetailBody), not the title row.
// decision: Pato (2026-10-16) — Save · Contact · Share sit in the profile
// summary. The pinned band is Reserve · Pay (Soon). Save is not Soon.
//   1. SlideOverHeader (shrink-0) — dismiss + place name
//   2. Scroll area (flex-1 overflow-y-auto) — PlaceDetailBody (ugly
//      Create profile included). Enrich is a tab until Enriched.
//   3. PlaceActionBar (shrink-0) — Reserve · Pay (Soon)
//
// Takes the whole `place` rather than id/name: the bar needs the full detail
// anyway, and the scalars were only ever projections of it.

export function PlaceDetailModalShell({
  children,
  place,
  onReserve,
}: {
  children: React.ReactNode;
  place: PlaceDetail;
  onReserve?: () => void;
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
      <PlaceActionBar place={place} onReserve={onReserve} />
    </>
  );
}
