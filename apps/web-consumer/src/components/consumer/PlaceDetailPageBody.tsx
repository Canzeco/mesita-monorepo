"use client";

import { PlaceDetailBody } from "./PlaceDetailBody";
import { PlaceDetailPageHeader } from "./PlaceDetailPageHeader";
import { PlaceActionBar } from "./place-detail/PlaceActionBar";
import type { PlaceDetail } from "@/lib/mock/place";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { isPartner } from "@/lib/promo-rates";

// Client wrapper for the hard-nav /place/[id] page. Mirrors the modal
// shell's three-band layout: header · scroll area · pinned action bar. The
// outer server page (place/[id]/page.tsx) stays server-rendered and just
// hands the place prop down. Save · Contact · Share scroll with the body;
// Visit · Order · Reserve are pinned (MESITA-1065).
//
// decision: Pato (live, MESITA-1070) — "place should not display bottom menu,
// only the back arrow". A place is a DETAIL surface, not a tab destination:
// the intercepted modal (how you actually arrive from swipe/favorites) already
// covers the tab bar, so the hard-nav page was the only route showing two
// stacked bottom bands — and a Visit button sitting directly above a Visit tab.
// One frame, one way out: the arrow.
//
// Suppressed in CSS from inside this component rather than by teaching
// BottomNav a route list, because the pathname CANNOT distinguish the two
// place surfaces — /place/[id] is the URL for both the hard-nav page and the
// intercepted modal. A route-based rule would therefore also hide the nav
// behind the slide-over, and since that panel animates in over 300ms the
// guest would watch the tab bar vanish from under it first. This style tag
// exists exactly as long as this component is mounted, and the modal never
// mounts it.
//
// `nav[data-shell-nav]` (0,1,1) outranks any single utility class, so it
// holds even if the nav later grows a `display` utility.

export function PlaceDetailPageBody({
  place,
  fallbackHref = CONSUMER_ROUTES.discoverDefault,
}: {
  place: PlaceDetail;
  /** Where the back arrow lands when there is no history to pop. */
  fallbackHref?: string;
}) {
  return (
    <div className="bg-background relative flex flex-1 flex-col overflow-hidden">
      <style>{`nav[data-shell-nav]{display:none}`}</style>
      <PlaceDetailPageHeader
        placeId={place.id}
        placeName={place.name}
        partner={isPartner(place)}
        fallbackHref={fallbackHref}
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
