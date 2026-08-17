import { redirect } from "next/navigation";
import { NotificationsClient } from "@/components/consumer/NotificationsClient";
import { createServerSupabase } from "@/lib/supabase/server";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// Inbox › Notifications — your own activity feed.
//
// YOUR activity only (Pato, 2026-08-17). Global activity was never a
// notification — it is other people moving, which is the Social feed's job —
// so it lives in Home > Social now and this section lost its toggle.
//
// Legacy /inbox/mine + /inbox/global both redirect here, which is what finally
// stopped "Inbox" naming two different surfaces (MESITA-1046).
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

  return <NotificationsClient userId={user.id} />;
}
