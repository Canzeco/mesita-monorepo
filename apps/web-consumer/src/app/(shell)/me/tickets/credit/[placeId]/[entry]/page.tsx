import { redirect } from "next/navigation";
import { CreditEntry } from "@/components/consumer/activity/CreditEntry";
import { ticketsHref } from "@/lib/ticket-kinds";
import { isRouteId } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// /me/tickets/credit/<placeId>/<kind>.<ms> — one credit movement (MESITA-3782; under Me › Tickets since MESITA-3855).
export default async function Page({ params }: { params: Promise<{ placeId: string; entry: string }> }) {
  const { placeId, entry } = await params;
  if (!isRouteId(placeId) || !/^[a-z_]+\.\d+$/.test(entry)) redirect(ticketsHref("vouchers"));
  return <CreditEntry placeId={placeId} entryKey={entry} />;
}
