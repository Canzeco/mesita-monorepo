import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type PayNotificationRow =
  Database["public"]["Tables"]["consumer_pay_notifications"]["Row"];

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
