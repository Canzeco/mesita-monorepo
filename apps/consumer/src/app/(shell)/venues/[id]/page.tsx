import { VenueDetailPageBody } from "@/components/consumer/VenueDetailPageBody";
import { mockVenue } from "@/lib/mock/venue";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchVenueDetail } from "@/lib/api/venues";

export const dynamic = "force-dynamic";

// Hard-nav landing for /venues/[id] (refresh, direct URL, new tab). Soft-nav
// from inside (shell) hits the intercepted modal variant instead.
//
// Fetches the real enriched venue via consumer-get-venue and adapts it to
// VenueDetail. Falls back to the mock fixture when the id/slug isn't found
// (unknown ids, the design fixture) so the surface never hard-404s mid-build.

export default async function VenueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const venue = (await apiFetchVenueDetail(supabase, id)) ?? mockVenue;
  return <VenueDetailPageBody venue={venue} />;
}
