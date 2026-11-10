import { loadPlaceOrLeave } from "@/lib/load-place";
import { PlaceDetailPageBody } from "@/components/consumer/PlaceDetailPageBody";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

export default async function PlaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const place = await loadPlaceOrLeave((await params).id);
  // fallbackHref, not backHref (MESITA-1070): the arrow pops history now, and
  // home is only where it lands when this tab has none to pop.
  return (
    <PlaceDetailPageBody place={place} fallbackHref={CONSUMER_ROUTES.home} />
  );
}
