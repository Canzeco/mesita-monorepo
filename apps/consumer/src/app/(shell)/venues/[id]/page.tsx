import { VenueDetailPageBody } from "@/components/consumer/VenueDetailPageBody";
import { mockVenue } from "@/lib/mock/venue";

export const dynamic = "force-dynamic";

// Hard-nav landing for /venues/[id] (refresh, direct URL, new tab). When
// a user soft-navs from inside (shell) — e.g. tapping a card on
// /discover/catalog — they hit the intercepted variant at
// (shell)/@modal/(.)venues/[id]/page.tsx instead, which renders inside a
// modal on top of the underlying surface.
//
// All the interactive bits — header buttons, action bar, reservation
// sheet state — live in VenueDetailPageBody (client component). The page
// itself stays server-rendered so the fetch (once it lands) can run on
// the server.
//
// Mocked: every id resolves to the same fixture in @/lib/mock/venue.

export default async function VenueDetailPage() {
  return <VenueDetailPageBody venue={mockVenue} />;
}
