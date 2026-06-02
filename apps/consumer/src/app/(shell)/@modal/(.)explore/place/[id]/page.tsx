import { redirect } from "next/navigation";
import { VenueDetailBody } from "@/components/consumer/VenueDetailBody";
import { VenueDetailModalShell } from "@/components/consumer/VenueDetailModalShell";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchVenueDetail } from "@/lib/api/venues";
import { toCanonicalPlaceHrefOrNull } from "@/lib/place-route";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

export default async function ExplorePlaceModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!toCanonicalPlaceHrefOrNull(id, "explore")) {
    redirect(CONSUMER_ROUTES.explore.swipe);
  }
  const supabase = await createServerSupabase();
  const venue = await apiFetchVenueDetail(supabase, id);
  if (!venue) {
    redirect(CONSUMER_ROUTES.explore.swipe);
  }
  return (
    <VenueDetailModalShell venueId={venue.id} venueName={venue.name}>
      <VenueDetailBody venue={venue} />
    </VenueDetailModalShell>
  );
}
