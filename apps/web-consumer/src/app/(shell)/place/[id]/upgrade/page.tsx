import { loadPlaceOrLeave } from "@/lib/load-place";
import { PlaceUpgradePage } from "@/components/consumer/place-detail/BoostSheet";

export const dynamic = "force-dynamic";

// Upgrade (MESITA-4111): a member page under the place. Checkout returns
// here with ?refill=, which the page settles and then drops.
export default async function PlaceUpgradeRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const place = await loadPlaceOrLeave((await params).id);
  return <PlaceUpgradePage place={place} />;
}
