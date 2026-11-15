import { redirect } from "next/navigation";
import { SendCreditPage } from "@/components/consumer/wallet/SendCredit";
import { CONSUMER_ROUTES, isRouteId } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// /wallet/place/<placeId>/send — send credit held at one place to a friend,
// its own page (MESITA-4096); it was a sheet over the House Card.
export default async function Page({ params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params;
  if (!isRouteId(placeId)) redirect(CONSUMER_ROUTES.walletSend);
  return <SendCreditPage placeId={placeId} />;
}
