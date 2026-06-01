import { redirect } from "next/navigation";
import { VenueDetailPageBody } from "@/components/consumer/VenueDetailPageBody";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchVenueDetail } from "@/lib/api/venues";
import { toCanonicalPlaceHrefOrNull } from "@/lib/place-route";

export const dynamic = "force-dynamic";

export default async function PlaceDetailPage({
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
  return <VenueDetailPageBody venue={venue} backHref="/swipe" />;
}
