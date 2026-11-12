import { redirect } from "next/navigation";
import { CreditEntry } from "@/components/consumer/activity/CreditEntry";
import { activityHref } from "@/lib/activity-types";
import { isRouteId } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// /activity/credit/<placeId>/<kind>.<ms> — one credit movement (MESITA-3782).
export default async function Page({ params }: { params: Promise<{ placeId: string; entry: string }> }) {
  const { placeId, entry } = await params;
  if (!isRouteId(placeId) || !/^[a-z_]+\.\d+$/.test(entry)) redirect(activityHref("vouchers"));
  return <CreditEntry placeId={placeId} entryKey={entry} />;
}
