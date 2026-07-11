import { redirect } from "next/navigation";
import {
  NotificationsClient,
  type InboxTab,
} from "@/components/consumer/NotificationsClient";
import { createServerSupabase } from "@/lib/supabase/server";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

function inboxTabFromSegment(seg: string): InboxTab | null {
  if (seg === "mine") return "mine";
  if (seg === "global") return "global";
  return null;
}

export default async function InboxTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab: tabSegment } = await params;
  if (tabSegment === "my-activity") redirect(CONSUMER_ROUTES.inbox.mine);
  if (tabSegment === "global-activity") redirect(CONSUMER_ROUTES.inbox.global);
  const tab = inboxTabFromSegment(tabSegment);
  if (!tab) redirect(CONSUMER_ROUTES.inbox.mine);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const next =
      tab === "mine"
        ? CONSUMER_ROUTES.inbox.mine
        : CONSUMER_ROUTES.inbox.global;
    redirect(`/?next=${encodeURIComponent(next)}`);
  }

  return <NotificationsClient userId={user.id} initialTab={tab} />;
}
