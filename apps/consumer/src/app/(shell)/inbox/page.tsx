import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { NotificationsClient } from "@/components/consumer/NotificationsClient";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  return <NotificationsClient userId={user.id} />;
}
