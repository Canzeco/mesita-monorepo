import { redirect } from "next/navigation";
import { GiftPage } from "@/components/consumer/activity/GiftPage";
import { ticketsHref } from "@/lib/ticket-kinds";
import { isRouteId } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// /me/tickets/gift/<giftId> — one gift, sender and receiver (MESITA-4066).
export default async function Page({ params }: { params: Promise<{ giftId: string }> }) {
  const { giftId } = await params;
  if (!isRouteId(giftId)) redirect(ticketsHref("gifts"));
  return <GiftPage giftId={giftId} />;
}
