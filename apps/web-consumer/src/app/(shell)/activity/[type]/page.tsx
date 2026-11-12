import { redirect } from "next/navigation";
import { ActivityPage } from "@/components/consumer/activity/ActivityPage";
import {
  activityHref,
  isActivityType,
  RETIRED_ACTIVITY_TYPES,
} from "@/lib/activity-types";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// /activity/<chip> — one Activity chip (MESITA-3811). A retired chip's name
// lands on its new chip; anything else on bare /activity.
export default async function Page({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!isActivityType(type)) {
    const moved = RETIRED_ACTIVITY_TYPES[type];
    redirect(moved ? activityHref(moved) : CONSUMER_ROUTES.activity);
  }
  return <ActivityPage />;
}
