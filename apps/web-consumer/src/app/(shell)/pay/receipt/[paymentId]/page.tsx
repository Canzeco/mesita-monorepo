import { redirect } from "next/navigation";
import { PayReceiptScreen } from "@/components/consumer/pay/PayReceiptScreen";
import { CONSUMER_ROUTES, isRouteId } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// /pay/receipt/<paymentId> — a paid bill's proof (MESITA-3459, MESITA-3614).
export default async function Page({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  if (!isRouteId(paymentId)) redirect(CONSUMER_ROUTES.pay);
  return <PayReceiptScreen paymentId={paymentId} />;
}
