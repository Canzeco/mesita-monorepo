"use client";

import { useState } from "react";
import {
  VenueDetailActionBar,
  VenueDetailBody,
} from "./VenueDetailBody";
import { VenueDetailPageHeader } from "./VenueDetailPageHeader";
import { ReservationSheet } from "./ReservationSheet";
import type { VenueDetail } from "@/lib/mock/venue";

// Client wrapper for the hard-nav /venues/[id] page so the ReservationSheet
// state stays at the same layout level as in the modal shell — the sheet
// mounts as a sibling of the action bar, not inside the scroll body. The
// outer server page (venues/[id]/page.tsx) stays server-rendered and just
// hands the venue prop down.
export function VenueDetailPageBody({ venue }: { venue: VenueDetail }) {
  const [reserveOpen, setReserveOpen] = useState(false);
  return (
    <div className="bg-background relative flex flex-1 flex-col overflow-hidden">
      <VenueDetailPageHeader venueId={venue.id} venueName={venue.name} />
      <div className="flex-1 overflow-y-auto">
        <VenueDetailBody venue={venue} />
      </div>
      <VenueDetailActionBar
        venueId={venue.id}
        venueName={venue.name}
        onReserve={() => setReserveOpen(true)}
      />
      <ReservationSheet
        venueId={venue.id}
        venueName={venue.name}
        open={reserveOpen}
        onClose={() => setReserveOpen(false)}
      />
    </div>
  );
}
