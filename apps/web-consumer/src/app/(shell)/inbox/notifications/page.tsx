import { redirect } from "next/navigation";
import { NotificationsClient } from "@/components/consumer/NotificationsClient";
import { createServerSupabase } from "@/lib/supabase/server";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// Inbox › Notifications — the feed, mine + global.
//
// This is the half MESITA-1046 left open: notifications used to sit at their
// own /inbox/mine + /inbox/global routes reached from Me, so "Inbox" named
// both a bottom tab and a separate surface. Both paths now redirect into this
// section, and mine/global became a toggle INSIDE it rather than two routes.
export default async function InboxNotificationsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/?next=${encodeURIComponent(CONSUMER_ROUTES.inbox.notifications)}`,
    );
  }

  return <NotificationsClient userId={user.id} initialTab="mine" />;
}
