import { VenueDetailBody } from "@/components/consumer/VenueDetailBody";
import { VenueDetailModalShell } from "@/components/consumer/VenueDetailModalShell";
import { mockVenue } from "@/lib/mock/venue";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchVenueDetail } from "@/lib/api/venues";

export const dynamic = "force-dynamic";

// Intercepted /venues/[id]. Fires on soft navigation from inside (shell) —
// e.g. tapping a venue card. Hard nav bypasses this and lands on the full
// page. Fetches the real enriched venue (mock fallback when not found).

export default async function VenueModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const venue = (await apiFetchVenueDetail(supabase, id)) ?? mockVenue;
  return (
    <VenueDetailModalShell venueId={venue.id} venueName={venue.name}>
      <VenueDetailBody venue={venue} />
    </VenueDetailModalShell>
  );
}
