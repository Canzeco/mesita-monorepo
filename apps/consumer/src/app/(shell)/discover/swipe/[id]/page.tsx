import { VenueDetailPageBody } from "@/components/consumer/VenueDetailPageBody";
import { mockVenue } from "@/lib/mock/venue";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchVenueDetail } from "@/lib/api/venues";

export const dynamic = "force-dynamic";

export default async function DiscoverSwipeVenuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const venue = (await apiFetchVenueDetail(supabase, id)) ?? mockVenue;
  return <VenueDetailPageBody venue={venue} backHref="/discover/swipe" />;
}
