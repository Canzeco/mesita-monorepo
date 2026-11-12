import { redirect } from "next/navigation";
import { ActivityPage } from "@/components/consumer/activity/ActivityPage";
import { activityHref, activityTypeOf } from "@/lib/activity-types";

// /activity — the bar's Activity tab (MESITA-3769), six chips. Bare, it is the
// Notifications chip. Each chip has its own path, /activity/<chip>
// (MESITA-3811); an older /activity?type=<chip> link 308s there, a retired or
// unknown one onto its chip or Notifications.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  const { type } = await searchParams;
  if (typeof type === "string") redirect(activityHref(activityTypeOf(type)));
  return <ActivityPage />;
}
