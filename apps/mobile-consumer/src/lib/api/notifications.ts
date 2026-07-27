// Consumer pay-notification helpers — mirror of
// apps/web-consumer/src/lib/api/notifications.ts. Clients call EFs only.

import { invokeEF } from '@/lib/ef';
import { supabase } from '@/lib/supabase';
import {
  payloadFromNotification,
  type PayNotificationRow,
  type TicketBillPayload,
} from '@/lib/api/pay';

type ConsumerNotificationRow = PayNotificationRow;

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

function enrichNotification(
  row: ConsumerNotificationRow,
): ConsumerNotification {
  return {
    ...row,
    bill: payloadFromNotification(row.payload),
  };
}

export async function fetchConsumerNotifications(
  _consumerId: string,
  limit = 40,
): Promise<ConsumerNotification[]> {
  const data = await invokeEF<ListPayNotificationsResult>(
    supabase,
    'consumer-web-list-pay-notifications',
    { limit },
  );
  return (data.notifications ?? []).map(enrichNotification);
}

export async function fetchPayTicketBundle(ticketId: string): Promise<{
  notifications: ConsumerNotificationRow[];
  ticketMeta: PayTicketMeta | null;
  placeInstagramUrl: string | null;
}> {
  const data = await invokeEF<ListPayNotificationsResult>(
    supabase,
    'consumer-web-list-pay-notifications',
    { ticketId },
  );
  return {
    notifications: data.notifications ?? [],
    ticketMeta: data.tickets?.[ticketId] ?? null,
    placeInstagramUrl: data.placeInstagramUrl ?? null,
  };
}

export async function fetchPayTicketList(): Promise<{
  notifications: ConsumerNotificationRow[];
  ticketMetaById: Map<string, PayTicketMeta>;
}> {
  const data = await invokeEF<ListPayNotificationsResult>(
    supabase,
    'consumer-web-list-pay-notifications',
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
