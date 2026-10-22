"use client";

import { PlaceTopBar } from "@mesita/place-profile";
import { useSlideOverClose } from "@/components/consumer/overlay/SlideOverShell";
import type { PlaceDetail } from "@/lib/place-detail";

// Content chrome for the intercepted /place/[id] route. The sliding panel
// itself (enter/exit animation, backdrop, ESC, router.back on dismiss) is
// SlideOverShell, mounted by the segment's layout.tsx — this component only
// fills it with the place's top bar and the scrollable body.
//
// THE TOP BAR IS THE PACKAGE'S PlaceTopBar (MESITA-2627), the same
// Instagram-style bar the direct-link page draws: bare chevron, bold sans
// name at the left with the Enriched mark before it, three dots that share.
// Until MESITA-2627 this shell drew SlideOverHeader (a bordered back square
// and a centred serif name), so a place opened from inside the app never
// got MESITA-2619's bar. The chevron closes the slide-over.
// decision: Pato (MESITA-451, revised) — the "Enriching" state lives as a
// chip in the profile summary (PlaceDetailBody), not the title row.
//   1. PlaceTopBar (shrink-0) — back · name · share
//   2. Scroll area (flex-1 overflow-y-auto) — PlaceDetailBody (ugly
//      Create profile included). Enrich is a tab until Enriched.

export function PlaceDetailModalShell({
  children,
  place,
  onShare,
}: {
  children: React.ReactNode;
  place: PlaceDetail;
  /** The three dots open the share sheet; absent, they are inert. */
  onShare?: () => void;
}) {
  const close = useSlideOverClose();
  return (
    <>
      <PlaceTopBar
        name={place.name}
        enriched={place.is_enriched}
        onBack={close}
        onShare={onShare}
      />
      {/*
        `min-h-0` is the load-bearing class here: without it, a flex-1 child
        keeps its default `min-height: auto` (= content size) and grows to
        fit the whole PlaceDetailBody — `overflow-y-auto` then never
        triggers, the page scrolls on the outer body instead, and
        `position: sticky top-0` on the tab strip ends up anchored to a
        scroll container that isn't actually scrolling.
      */}
      {/* THE GREY GROUND (Pato, MESITA-2662: "keep the slightly gray
          background in Overview, boxes white"): the slide-over panel is
          paper, so the scroller paints bg-background like the direct link's
          PlaceProfile; Overview's cards stay white on it. */}
      <div className="bg-background min-h-0 flex-1 overflow-y-auto">
        {children}
      </div>
    </>
  );
}
