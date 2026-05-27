import {
  VenueDetailActionBar,
  VenueDetailBody,
} from "@/components/consumer/VenueDetailBody";
import { VenueDetailPageHeader } from "@/components/consumer/VenueDetailPageHeader";
import { mockVenue } from "@/lib/mock/venue";

export const dynamic = "force-dynamic";

// Hard-nav landing for /venues/[id] (refresh, direct URL, new tab). When
// a user soft-navs from inside (shell) — e.g. tapping a card on
// /discover/catalog — they hit the intercepted variant at
// (shell)/@modal/(.)venues/[id]/page.tsx instead, which renders inside a
// modal on top of the underlying surface.
//
// Layout mirrors the modal shell — header, scroll area, action bar in
// three rigid flex-col rows — so the opaque CTA buttons never occlude the
// scrolled-past body content. The header is a client component
// (VenueDetailPageHeader) because the Share + Bookmark buttons need
// runtime hooks (useSavedVenues, navigator.share, toast).
//
// Mocked: every id resolves to the same fixture in @/lib/mock/venue.

export default async function VenueDetailPage() {
  return (
    <div className="bg-background relative flex flex-1 flex-col overflow-hidden">
      <VenueDetailPageHeader
        venueId={mockVenue.id}
        venueName={mockVenue.name}
      />
      <div className="flex-1 overflow-y-auto">
        <VenueDetailBody venue={mockVenue} />
      </div>
      <VenueDetailActionBar
        venueId={mockVenue.id}
        venueName={mockVenue.name}
      />
    </div>
  );
}
