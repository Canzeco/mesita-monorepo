// Rewards — THE PLACE's earning: Visit Rewards and the strategy behind it.
//
// New in MESITA-1841, split out of Capabilities. The gate is Capabilities'
// gate, because the write is the same write: a viewer may read the place but
// never price it.
import { notFound } from "next/navigation";
import { getManagePlace, getPlaceView, visibleTabs } from "@/lib/place-view";
import { createServerSupabase } from "@/lib/supabase/server";
import { RewardsTab } from "./RewardsTab";

export const dynamic = "force-dynamic";

export default async function RewardsPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const supabase = await createServerSupabase();
  const [view, manage] = await Promise.all([
    getPlaceView(supabase, id).catch(() => null),
    getManagePlace(id),
  ]);
  // A URL is not a capability (the ONE matrix, lib/place-tabs). Both reads are
  // request-cached — the layout above already paid for them.
  if (!view || !manage || !visibleTabs(view, manage).includes("rewards")) {
    notFound();
  }
  return <RewardsTab />;
}
