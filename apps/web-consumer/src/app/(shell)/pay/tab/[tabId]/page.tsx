import { redirect } from "next/navigation";
import { PayTabScreen } from "@/components/consumer/pay/PayTabScreen";
import { CONSUMER_ROUTES, isRouteId } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// /pay/tab/<tabId> — the bill at the table (MESITA-3564, MESITA-3614).
export default async function Page({ params }: { params: Promise<{ tabId: string }> }) {
  const { tabId } = await params;
  if (!isRouteId(tabId)) redirect(CONSUMER_ROUTES.pay);
  return <PayTabScreen start={{ kind: "tab", tabId }} />;
}
