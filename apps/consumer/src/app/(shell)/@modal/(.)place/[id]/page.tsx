import { redirect } from "next/navigation";
import { VenueDetailBody } from "@/components/consumer/VenueDetailBody";
import { VenueDetailModalShell } from "@/components/consumer/VenueDetailModalShell";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchVenueDetail } from "@/lib/api/venues";
import { toCanonicalPlaceHrefOrNull } from "@/lib/place-route";

export const dynamic = "force-dynamic";

export default async function PlaceDetailModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!toCanonicalPlaceHrefOrNull(id)) {
    redirect("/swipe");
  }
  const supabase = await createServerSupabase();
  const venue = await apiFetchVenueDetail(supabase, id);
  if (!venue) {
    redirect("/swipe");
  }
  return (
    <VenueDetailModalShell venueId={venue.id} venueName={venue.name}>
      <VenueDetailBody venue={venue} />
    </VenueDetailModalShell>
  );
}
