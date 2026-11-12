import { redirect } from "next/navigation";
import { VisitSummary } from "@/components/consumer/activity/VisitSummary";
import { activityHref } from "@/lib/activity-types";
import { isRouteId } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// /activity/visit/<tabId> — a finished Visit on one page (MESITA-3770).
export default async function Page({ params }: { params: Promise<{ tabId: string }> }) {
  const { tabId } = await params;
  if (!isRouteId(tabId)) redirect(activityHref("visits"));
  return <VisitSummary tabId={tabId} />;
}
