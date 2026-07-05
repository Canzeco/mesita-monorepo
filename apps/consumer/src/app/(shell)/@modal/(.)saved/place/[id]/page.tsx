import { redirect } from "next/navigation";
import { PlaceDetailBody } from "@/components/consumer/PlaceDetailBody";
import { PlaceDetailModalShell } from "@/components/consumer/PlaceDetailModalShell";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchPlaceDetail } from "@/lib/api/places";
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
    redirect(CONSUMER_ROUTES.favorites);
  }
  const supabase = await createServerSupabase();
  const place = await apiFetchPlaceDetail(supabase, id);
  if (!place) {
    redirect(CONSUMER_ROUTES.favorites);
  }
  return (
    <PlaceDetailModalShell projectId={place.id} placeName={place.name}>
      <PlaceDetailBody place={place} />
    </PlaceDetailModalShell>
  );
}
