import { redirect } from "next/navigation";
import { VisitSummary } from "@/components/consumer/activity/VisitSummary";
import { ticketsHref } from "@/lib/ticket-kinds";
import { isRouteId } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// /me/tickets/visits/<visitId> — a finished Visit on one page (MESITA-3770; under Me › Tickets since MESITA-3855).
export default async function Page({ params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await params;
  if (!isRouteId(visitId)) redirect(ticketsHref("visits"));
  return <VisitSummary tabId={visitId} />;
}
