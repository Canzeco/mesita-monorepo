import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type TicketPaymentSessionResult = {
  client_secret?: string;
  session_id?: string;
  mock?: boolean;
};

export async function createTicketPaymentSession(
  client: SupabaseClient,
  opts: { ticketId: string; returnUrl?: string },
): Promise<TicketPaymentSessionResult> {
  return invokeEF<TicketPaymentSessionResult>(
    client,
    "consumer-create-ticket-payment",
    {
      ticketId: opts.ticketId,
      returnUrl: opts.returnUrl,
    },
    "Couldn't start payment",
  );
}

export async function markTicketPaidMock(
  client: SupabaseClient,
  ticketId: string,
): Promise<void> {
  await invokeEF<{ ticket?: unknown }>(
    client,
    "business-mark-paid",
    { ticketId },
    "Couldn't complete demo payment",
  );
}
