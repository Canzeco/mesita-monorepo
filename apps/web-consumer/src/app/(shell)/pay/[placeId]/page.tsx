import { redirect } from "next/navigation";
import { PayTabScreen } from "@/components/consumer/pay/PayTabScreen";
import { CONSUMER_ROUTES, isRouteId } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// /pay/<placeId> — the door to pay at a place (MESITA-3614): opens the
// guest's bill there and becomes /pay/tab/<id>.
export default async function Page({ params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params;
  if (!isRouteId(placeId)) redirect(CONSUMER_ROUTES.pay);
  return <PayTabScreen start={{ kind: "place", placeId }} />;
}
