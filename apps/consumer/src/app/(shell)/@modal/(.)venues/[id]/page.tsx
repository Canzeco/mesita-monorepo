import { VenueDetailBody } from "@/components/consumer/VenueDetailBody";
import { VenueDetailModalShell } from "@/components/consumer/VenueDetailModalShell";
import { mockVenue } from "@/lib/mock/venue";

export const dynamic = "force-dynamic";

// Intercepted /venues/[id]. Fires only on soft navigation from inside
// (shell) — e.g. tapping a venue card in /discover/catalog. The underlying
// surface stays mounted; this renders inside the @modal slot on top.
//
// Hard navigation (refresh, direct URL, new tab) bypasses the interceptor
// and lands on src/app/(shell)/venues/[id]/page.tsx — the full page.
//
// Mocked: every id resolves to the same fixture in @/lib/mock/venue.

export default async function VenueModalPage() {
  return (
    <VenueDetailModalShell venueId={mockVenue.id} venueName={mockVenue.name}>
      <VenueDetailBody venue={mockVenue} />
    </VenueDetailModalShell>
  );
}
