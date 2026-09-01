import { redirect } from "next/navigation";
import { PlaceDetailBody } from "@/components/consumer/PlaceDetailBody";
import { PlaceDetailModalShell } from "@/components/consumer/PlaceDetailModalShell";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchPlaceDetail } from "@/lib/api/places";
import { placeGoneHref, toCanonicalPlaceHrefOrNull } from "@/lib/place-route";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

export default async function PlaceModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!toCanonicalPlaceHrefOrNull(id)) {
    redirect(CONSUMER_ROUTES.discoverDefault);
  }
  const supabase = await createServerSupabase();
  const place = await apiFetchPlaceDetail(supabase, id);
  if (!place) {
    // Dead id (reset-away row, stale localStorage favorite, old bookmark).
    // Bounce, but say so — see <PlaceGoneNotice />.
    redirect(placeGoneHref(CONSUMER_ROUTES.discoverDefault, id));
  }
  return (
    <PlaceDetailModalShell place={place}>
      <PlaceDetailBody place={place} />
    </PlaceDetailModalShell>
  );
}
