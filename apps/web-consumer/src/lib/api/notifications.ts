import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { invokeEF } from "./_invoke";

// Me › Notifications. The EF's name predates this screen, and it returns more
// than the rows; this reader takes the rows alone.

export type ConsumerNotification =
  Database["public"]["Tables"]["consumer_notifications"]["Row"];

type ListNotificationsResult = {
  notifications: ConsumerNotification[];
};

export async function fetchConsumerNotifications(
  client: SupabaseClient<Database>,
  limit = 40,
): Promise<ConsumerNotification[]> {
  const data = await invokeEF<ListNotificationsResult>(
    client,
    "consumer-web-list-pay-notifications",
    { limit },
  );
  return data.notifications ?? [];
}
