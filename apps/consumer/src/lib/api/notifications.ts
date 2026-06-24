import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { payloadFromNotification, type TicketBillPayload } from "@/lib/api/pay";

export type ConsumerNotificationRow =
  Database["public"]["Tables"]["consumer_pay_notifications"]["Row"];

export type ConsumerNotification = ConsumerNotificationRow & {
  bill: TicketBillPayload;
};

export function enrichNotification(
  row: ConsumerNotificationRow,
): ConsumerNotification {
  return {
    ...row,
    bill: payloadFromNotification(row.payload),
  };
}

export async function fetchConsumerNotifications(
  supabase: SupabaseClient<Database>,
  consumerId: string,
  limit = 40,
): Promise<ConsumerNotification[]> {
  const { data, error } = await supabase
    .from("consumer_pay_notifications")
    .select("*")
    .eq("consumer_id", consumerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(enrichNotification);
}

export async function fetchPendingNotificationCount(
  supabase: SupabaseClient<Database>,
  consumerId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("consumer_pay_notifications")
    .select("id", { count: "exact", head: true })
    .eq("consumer_id", consumerId)
    .eq("status", "pending");
  if (error) return 0;
  return count ?? 0;
}
