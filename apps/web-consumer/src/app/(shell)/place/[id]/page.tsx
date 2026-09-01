import { redirect } from "next/navigation";
import { PlaceDetailPageBody } from "@/components/consumer/PlaceDetailPageBody";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchPlaceDetail } from "@/lib/api/places";
import { placeGoneHref, toCanonicalPlaceHrefOrNull } from "@/lib/place-route";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

export default async function PlaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!toCanonicalPlaceHrefOrNull(id)) {
    redirect(CONSUMER_ROUTES.search);
  }
  const supabase = await createServerSupabase();
  const place = await apiFetchPlaceDetail(supabase, id);
  if (!place) {
    // Dead id (reset-away row, stale localStorage favorite, old bookmark).
    // Bounce, but say so — see <PlaceGoneNotice />.
    redirect(placeGoneHref(CONSUMER_ROUTES.search, id));
  }
  // fallbackHref, not backHref (MESITA-1070): the arrow pops history now, and
  // home is only where it lands when this tab has none to pop.
  return (
    <PlaceDetailPageBody place={place} fallbackHref={CONSUMER_ROUTES.search} />
  );
}
