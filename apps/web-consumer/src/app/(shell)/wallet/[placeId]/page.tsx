import { redirect } from "next/navigation";
import { WalletPlaceScreen } from "@/components/consumer/wallet/WalletPlaceScreen";
import { CONSUMER_ROUTES, isRouteId } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// /wallet/<placeId> — a place's House Card (MESITA-3533, MESITA-3614).
export default async function Page({ params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params;
  if (!isRouteId(placeId)) redirect(CONSUMER_ROUTES.pay);
  return <WalletPlaceScreen placeId={placeId} />;
}
