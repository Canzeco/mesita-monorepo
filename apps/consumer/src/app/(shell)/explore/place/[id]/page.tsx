import { redirect } from "next/navigation";
import { VenueDetailPageBody } from "@/components/consumer/VenueDetailPageBody";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchVenueDetail } from "@/lib/api/venues";
import { toCanonicalPlaceHrefOrNull } from "@/lib/place-route";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

export default async function ExplorePlacePage({
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
    <VenueDetailPageBody
      venue={venue}
      backHref={CONSUMER_ROUTES.explore.swipe}
    />
  );
}
