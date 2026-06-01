"use client";

import { VenueDetailActionBar, VenueDetailBody } from "./VenueDetailBody";
import { VenueDetailPageHeader } from "./VenueDetailPageHeader";
import type { VenueDetail } from "@/lib/mock/venue";

// Client wrapper for the hard-nav /place/[id] page. Mirrors the modal
// shell's three-row layout so the action bar sits as a sibling of the
// scroll body rather than inside it. The outer server page
// (place/[id]/page.tsx) stays server-rendered and just hands the venue
// prop down. (Reservations are parked, so the booking sheet is no longer
// mounted here — see VenueDetailActionBar.)
export function VenueDetailPageBody({
  venue,
  backHref = "/swipe",
}: {
  venue: VenueDetail;
  backHref?: string;
}) {
  return (
    <div className="bg-background relative flex flex-1 flex-col overflow-hidden">
      <VenueDetailPageHeader
        venueId={venue.id}
        venueName={venue.name}
        backHref={backHref}
      />
      {/*
        `min-h-0` mirrors VenueDetailModalShell — without it the flex-1
        scroll container grows to fit content, `overflow-y-auto` never
        triggers, and the sticky section nav can't pin against a
        non-scrolling parent. See VenueDetailModalShell for the long form.
      */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <VenueDetailBody venue={venue} />
      </div>
      <VenueDetailActionBar venueId={venue.id} venueName={venue.name} />
    </div>
  );
}
