import { redirect } from "next/navigation";
import { PayTabScreen } from "@/components/consumer/pay/PayTabScreen";
import { CONSUMER_ROUTES, isRouteId } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// /pay/bill/<billId> — the bill at the table (MESITA-3564, MESITA-3614).
// The address says bill, the word the guest reads; the wire keeps `tab`
// (pay_tabs, the EF bodies), so the id is handed on as `tabId` (MESITA-4013).
export default async function Page({ params }: { params: Promise<{ billId: string }> }) {
  const { billId } = await params;
  if (!isRouteId(billId)) redirect(CONSUMER_ROUTES.pay);
  return <PayTabScreen start={{ kind: "tab", tabId: billId }} />;
}
