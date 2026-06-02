import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type PayNotificationRow =
  Database["public"]["Tables"]["consumer_pay_notifications"]["Row"];

/** Stored on consumer_pay_notifications.payload for Pay → Tickets. */
export type TicketBillPayload = {
  venue_id?: string;
  venue_slug?: string | null;
  venue_name?: string;
  venue_photo_url?: string | null;
  check_subtotal_cents?: number;
  tip_cents?: number;
  total_cents?: number;
  discount_cents?: number;
  discount_percent?: number | null;
  redeem_cents?: number;
  total_reward_cents?: number;
  amount_due_cents?: number;
  currency?: string;
};

export function formatPayMx(
  cents: number | undefined | null,
  currency = "MXN",
): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)} ${currency}`;
}

export function payloadFromNotification(
  payload: PayNotificationRow["payload"],
): TicketBillPayload {
  if (!payload || typeof payload !== "object") return {};
  return payload as TicketBillPayload;
}

export async function confirmTicketPayment(
  supabase: SupabaseClient<Database>,
  ticketId: string,
) {
  const { data, error } = await supabase.functions.invoke(
    "consumer-confirm-ticket-payment",
    { body: { ticketId } },
  );
  if (error) throw error;
  const body = data as { ok?: boolean; error?: string };
  if (!body?.ok) throw new Error(body?.error ?? "Could not confirm payment");
  return body;
}

export async function submitTicketReview(
  supabase: SupabaseClient<Database>,
  input: {
    ticketId: string;
    food: number;
    service: number;
    ambiance: number;
    overall: number;
    comments?: string;
  },
) {
  const { data, error } = await supabase.functions.invoke(
    "consumer-submit-ticket-review",
    { body: input },
  );
  if (error) throw error;
  const body = data as { ok?: boolean; error?: string };
  if (!body?.ok) throw new Error(body?.error ?? "Could not submit review");
  return body;
}
