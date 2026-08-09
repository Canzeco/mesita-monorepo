import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { invokeEF } from "./_invoke";
import { payloadFromNotification, type TicketBillPayload } from "@/lib/api/pay";

type ConsumerNotificationRow =
  Database["public"]["Tables"]["consumer_pay_notifications"]["Row"];

export type ConsumerNotification = ConsumerNotificationRow & {
  bill: TicketBillPayload;
};

type PayTicketMeta = {
  kind?: string;
  status?: string;
  story_status?: string;
  story_submitted_at?: string | null;
  first_scanned_at?: string | null;
  total_cents?: number | null;
  discount_percent?: number | null;
  capMxn?: number | null;
  created_at?: string | null;
};

type ListPayNotificationsResult = {
  notifications: ConsumerNotificationRow[];
  tickets: Record<string, PayTicketMeta>;
  placeInstagramUrl?: string | null;
};

function enrichNotification(
  row: ConsumerNotificationRow,
): ConsumerNotification {
  return {
    ...row,
    bill: payloadFromNotification(row.payload),
  };
}

export async function fetchConsumerNotifications(
  client: SupabaseClient<Database>,
  _consumerId: string,
  limit = 40,
): Promise<ConsumerNotification[]> {
  const data = await invokeEF<ListPayNotificationsResult>(
    client,
    "consumer-web-list-pay-notifications",
    { limit },
  );
  return (data.notifications ?? []).map(enrichNotification);
}
