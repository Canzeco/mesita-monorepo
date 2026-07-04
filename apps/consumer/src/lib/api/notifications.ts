import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { invokeEF } from "./_invoke";
import { payloadFromNotification, type TicketBillPayload } from "@/lib/api/pay";

export type ConsumerNotificationRow =
  Database["public"]["Tables"]["consumer_pay_notifications"]["Row"];

export type ConsumerNotification = ConsumerNotificationRow & {
  bill: TicketBillPayload;
};

export type PayTicketMeta = {
  kind?: string;
  status?: string;
  story_status?: string;
  story_submitted_at?: string | null;
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

export function enrichNotification(
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
    "consumer-list-pay-notifications",
    { limit },
  );
  return (data.notifications ?? []).map(enrichNotification);
}

export async function fetchPayTicketBundle(
  client: SupabaseClient<Database>,
  ticketId: string,
): Promise<{
  notifications: ConsumerNotificationRow[];
  ticketMeta: PayTicketMeta | null;
  placeInstagramUrl: string | null;
}> {
  const data = await invokeEF<ListPayNotificationsResult>(
    client,
    "consumer-list-pay-notifications",
    { ticketId },
  );
  return {
    notifications: data.notifications ?? [],
    ticketMeta: data.tickets?.[ticketId] ?? null,
    placeInstagramUrl: data.placeInstagramUrl ?? null,
  };
}

export async function fetchPayTicketList(
  client: SupabaseClient<Database>,
): Promise<{
  notifications: ConsumerNotificationRow[];
  ticketMetaById: Map<string, PayTicketMeta>;
}> {
  const data = await invokeEF<ListPayNotificationsResult>(
    client,
    "consumer-list-pay-notifications",
    {},
  );
  const ticketMetaById = new Map<string, PayTicketMeta>(
    Object.entries(data.tickets ?? {}),
  );
  return {
    notifications: data.notifications ?? [],
    ticketMetaById,
  };
}

export async function fetchPendingNotificationCount(
  client: SupabaseClient<Database>,
  _consumerId: string,
): Promise<number> {
  try {
    const data = await invokeEF<{ pendingCount: number }>(
      client,
      "consumer-list-pay-notifications",
      { pendingCountOnly: true },
    );
    return data.pendingCount ?? 0;
  } catch {
    return 0;
  }
}
