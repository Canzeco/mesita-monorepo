import { loadPlaceOrLeave } from "@/lib/load-place";
import { OffersPageBody } from "@/components/consumer/OffersPageBody";

export const dynamic = "force-dynamic";

// THE OFFERS PAGE (MESITA-4379): a full page like Reserve, never
// intercepted (@modal has no (.)place/[id]/offers) and never a sheet over
// the profile. The place profile lives in the (profile) group beside it, so
// its skeleton never stands in for this page while it loads.
export default async function PlaceOffersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const place = await loadPlaceOrLeave((await params).id);
  return <OffersPageBody place={place} />;
}
