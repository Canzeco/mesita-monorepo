import { redirect } from "next/navigation";
import { VenueDetailBody } from "@/components/consumer/VenueDetailBody";
import { VenueDetailModalShell } from "@/components/consumer/VenueDetailModalShell";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchVenueDetail } from "@/lib/api/venues";
import { toCanonicalPlaceHrefOrNull } from "@/lib/place-route";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

export default async function SavedPlaceModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!toCanonicalPlaceHrefOrNull(id, "saved")) {
    redirect(CONSUMER_ROUTES.saved.places);
  }
  const supabase = await createServerSupabase();
  const venue = await apiFetchVenueDetail(supabase, id);
  if (!venue) {
    redirect(CONSUMER_ROUTES.saved.places);
  }
  return (
    <VenueDetailModalShell venueId={venue.id} venueName={venue.name}>
      <VenueDetailBody venue={venue} />
    </VenueDetailModalShell>
  );
}
