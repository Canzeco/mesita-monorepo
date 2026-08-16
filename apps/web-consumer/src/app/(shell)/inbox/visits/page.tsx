import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { InboxVisitsClient } from "./InboxVisitsClient";

export const dynamic = "force-dynamic";

// Inbox › Visits — the default Inbox section. Server-gated for the user id;
// the ticket list itself loads client-side and owns its retry.
export default async function InboxVisitsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/?next=${encodeURIComponent(CONSUMER_ROUTES.inbox.visits)}`);
  }

  return <InboxVisitsClient userId={user.id} />;
}
