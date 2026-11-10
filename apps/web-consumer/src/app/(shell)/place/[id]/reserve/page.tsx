import { redirect } from "next/navigation";
import { ReservePageBody } from "@/components/consumer/ReservePageBody";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchPlaceDetail } from "@/lib/api/places";
import { placeGoneHref, toCanonicalPlaceHrefOrNull } from "@/lib/place-route";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// THE RESERVE PAGE (MESITA-3609): the place's Reserve tile pushes here. A full
// page, never intercepted: @modal has no (.)place/[id]/reserve, and
// isModalContractPath excludes this path, so a push from the place slide-over
// drops the panel. Signed-in only, like every (shell) route.
export default async function PlaceReservePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!toCanonicalPlaceHrefOrNull(id)) {
    redirect(CONSUMER_ROUTES.home);
  }
  const supabase = await createServerSupabase();
  const place = await apiFetchPlaceDetail(supabase, id);
  if (!place) {
    redirect(placeGoneHref(CONSUMER_ROUTES.home, id));
  }
  return (
    <ReservePageBody
      place={{ id: place.id, name: place.name, hours_table: place.hours_table }}
    />
  );
}
